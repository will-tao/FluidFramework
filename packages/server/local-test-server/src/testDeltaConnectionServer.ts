/*!
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

import { RoundTrip } from "@prague/client-api";
import {
    LocalNodeFactory,
    LocalOrderer,
    LocalOrderManager,
    NodeManager,
    ReservationManager,
} from "@prague/memory-orderer";
import {
    IClient,
    IContentMessage,
    IDocumentMessage,
    ISignalMessage,
    ITokenClaims,
} from "@prague/protocol-definitions";
import {
    ICollection,
    IDatabaseManager,
    IOrderer,
    IOrdererConnection,
    IOrdererManager,
    ITenantManager,
    IWebSocket,
    IWebSocketServer,
    MongoDatabaseManager,
    MongoManager,
} from "@prague/services-core";
import { IConnect, IConnected } from "@prague/socket-storage-shared";
import {
    TestCollection,
    TestDbFactory,
    TestDocumentStorage,
    TestTaskMessageSender,
    TestTenantManager,
    TestWebSocketServer,
} from "@prague/test-utils";
import * as jwt from "jsonwebtoken";
import * as randomName from "random-name";
import * as semver from "semver";

const protocolVersion = "^0.1.0";

/**
 * Items needed for handling deltas.
 */
export interface ITestDeltaConnectionServer {
    webSocketServer: IWebSocketServer;
    databaseManager: IDatabaseManager;

    hasPendingWork(): Promise<boolean>;
}

/**
 * Implementation of order manager for testing.
 */
class TestOrderManager implements IOrdererManager {
    private readonly orderersP: Promise<IOrderer>[] = [];

    /**
     * @param orderer - instance of in-memory orderer for the manager to provide
     */
    constructor(private orderer: LocalOrderManager) {
    }

    /**
     * Returns the op orderer for the given tenant ID and document ID
     * using the local in-memory orderer manager instance.
     * @param tenantId - ID of tenant
     * @param documentId - ID of document
     */
    public getOrderer(tenantId: string, documentId: string): Promise<IOrderer> {
        const p = this.orderer.get(tenantId, documentId);
        this.orderersP.push(p);
        return p;
    }

    /**
     * Returns true if there are any received ops that are not yet ordered.
     */
    public async hasPendingWork(): Promise<boolean> {
        return Promise.all(this.orderersP).then((orderers) => {
            for (const orderer of orderers) {
                // We know that it ia LocalOrderer, break the abstraction
                if ((orderer as LocalOrderer).hasPendingWork()) {
                    return true;
                }
            }
            return false;
        });
    }
}

/**
 * Implementation of delta connection server for testing.
 */
export class TestDeltaConnectionServer implements ITestDeltaConnectionServer {
    /**
     * Creates and returns a delta connection server for testing.
     */
    public static create(): ITestDeltaConnectionServer {
        const nodesCollectionName = "nodes";
        const documentsCollectionName = "documents";
        const deltasCollectionName = "deltas";
        const reservationsCollectionName = "reservations";
        const scribeDeltasCollectionName = "scribeDeltas";
        const testData: { [key: string]: any[] } = {};

        const webSocketServer = new TestWebSocketServer();
        const testDbFactory = new TestDbFactory(testData);
        const mongoManager = new MongoManager(testDbFactory);
        const testTenantManager = new TestTenantManager();

        const databaseManager = new MongoDatabaseManager(
            mongoManager,
            nodesCollectionName,
            documentsCollectionName,
            deltasCollectionName,
            scribeDeltasCollectionName);

        const testStorage = new TestDocumentStorage(
            databaseManager,
            testTenantManager);

        const nodeManager = new NodeManager(mongoManager, nodesCollectionName);
        const reservationManager = new ReservationManager(
            nodeManager,
            mongoManager,
            reservationsCollectionName);

        const nodeFactory = new LocalNodeFactory(
            "os",
            "http://localhost:4000", // unused placeholder url
            testStorage,
            databaseManager,
            60000,
            () => webSocketServer,
            new TestTaskMessageSender(),
            testTenantManager,
            {},
            16 * 1024);
        const localOrderManager = new LocalOrderManager(nodeFactory, reservationManager);
        const testOrderer = new TestOrderManager(localOrderManager);
        const testCollection = new TestCollection([]);

        register(
            webSocketServer,
            testOrderer,
            testTenantManager,
            testCollection);

        return new TestDeltaConnectionServer(webSocketServer, databaseManager, testOrderer);
    }

    private constructor(
        public webSocketServer: IWebSocketServer,
        public databaseManager: IDatabaseManager,
        private testOrdererManager: TestOrderManager) { }

    /**
     * Returns true if there are any received ops that are not yet ordered.
     */
    public async hasPendingWork(): Promise<boolean> {
        return this.testOrdererManager.hasPendingWork();
    }
}

/**
 * Registers listeners to web socket server events for handling connection,
 * ops, and signals.
 * @param webSocketServer - web socket server to listen to
 * @param orderManager - instance of op ordering manager
 * @param tenantManager - instance of tenant manager
 * @param contentCollection - collection of any op content
 */
// Forked from io.ts in alfred, which has service dependencies and cannot run in a browser.
// Further simplifications are likely possible.
// tslint:disable:no-unsafe-any
export function register(
    webSocketServer: IWebSocketServer,
    orderManager: IOrdererManager,
    tenantManager: ITenantManager,
    contentCollection: ICollection<any>) {

    webSocketServer.on("connection", (socket: IWebSocket) => {
        // Map from client IDs on this connection to the object ID and user info.
        const connectionsMap = new Map<string, IOrdererConnection>();
        // Map from client IDs to room.
        const roomMap = new Map<string, string>();

        async function connectDocument(message: IConnect): Promise<IConnected> {
            // Validate token signature and claims
            const token = message.token;
            const claims = jwt.decode(token) as ITokenClaims;
            if (claims.documentId !== message.id || claims.tenantId !== message.tenantId) {
                return Promise.reject("Invalid claims");
            }
            await tenantManager.verifyToken(claims.tenantId, token);

            const clientId = `${randomName.first()}-${randomName.last()}`;

            const messageClient: Partial<IClient> = message.client ? message.client : {};
            messageClient.user = claims.user;
            messageClient.scopes = claims.scopes;

            // Join the room to receive signals.
            roomMap.set(clientId, `${claims.tenantId}/${claims.documentId}`);

            // Iterate over the version ranges provided by the client and select the best one that works
            const connectVersions = message.versions ? message.versions : ["^0.1.0"];
            let version: string = null;
            for (const connectVersion of connectVersions) {
                if (semver.intersects(protocolVersion, connectVersion)) {
                    version = protocolVersion;
                    break;
                }
            }

            if (!version) {
                return Promise.reject(
                    `Unsupported client protocol.` +
                    `Server: ${protocolVersion}. ` +
                    `Client: ${JSON.stringify(connectVersions)}`);
            }

            if (canWrite(messageClient.scopes)) {
                const orderer = await orderManager.getOrderer(claims.tenantId, claims.documentId);
                const connection = await orderer.connect(socket, clientId, messageClient as IClient);
                connectionsMap.set(clientId, connection);

                const connectedMessage: IConnected = {
                    claims,
                    clientId,
                    existing: connection.existing,
                    maxMessageSize: connection.maxMessageSize,
                    parentBranch: connection.parentBranch,
                    serviceConfiguration: connection.serviceConfiguration,
                    supportedVersions: [protocolVersion],
                    version,
                };

                return connectedMessage;
            } else {
                // Todo (mdaumi): We should split storage stuff from orderer to get the following fields right.
                const connectedMessage: IConnected = {
                    claims,
                    clientId,
                    existing: true, // Readonly client can only open an existing document.
                    maxMessageSize: 1024, // Readonly client can't send ops.
                    parentBranch: null, // Does not matter for now.
                    serviceConfiguration: {
                        blockSize: 64436,
                        maxMessageSize:  16 * 1024,
                        summary: {
                            idleTime: 5000,
                            maxOps: 1000,
                            maxTime: 5000 * 12,
                        },
                    },
                    supportedVersions: [protocolVersion],
                    version,
                };

                return connectedMessage;
            }
        }

        function canWrite(scopes: string[]): boolean {
            return true;
        }

        // Note connect is a reserved socket.io word so we use connect_document to represent the connect request
        socket.on("connect_document", async (message: IConnect) => {
            connectDocument(message).then(
                (connectedMessage) => {
                    socket.emit("connect_document_success", connectedMessage);
                },
                (error) => {
                    socket.emit("connect_document_error", error);
                });
        });

        // Message sent when a new operation is submitted to the router
        socket.on(
            "submitOp",
            (clientId: string, messageBatches: (IDocumentMessage | IDocumentMessage[])[], response) => {
                // Verify the user has connected on this object id
                if (!connectionsMap.has(clientId)) {
                    return response("Invalid client ID", null);
                }

                const connection = connectionsMap.get(clientId);

                messageBatches.forEach((messageBatch) => {
                    const messages = Array.isArray(messageBatch) ? messageBatch : [messageBatch];
                    const filtered = messages
                        .filter((message) => message.type !== RoundTrip);

                    if (filtered.length > 0) {
                        connection.order(filtered);
                    }
                });

                // A response callback used to be used to verify the send. Newer drivers do not use this. Will be
                // removed in 0.9
                if (response) {
                    response(null);
                }
            });

        // Message sent when a new splitted operation is submitted to the router
        socket.on("submitContent", (clientId: string, message: IDocumentMessage, response) => {
            // Verify the user has connected on this object id
            if (!connectionsMap.has(clientId) || !roomMap.has(clientId)) {
                return response("Invalid client ID", null);
            }

            const broadCastMessage: IContentMessage = {
                clientId,
                clientSequenceNumber: message.clientSequenceNumber,
                contents: message.contents,
            };

            const connection = connectionsMap.get(clientId);

            const dbMessage = {
                clientId,
                documentId: connection.documentId,
                op: broadCastMessage,
                tenantId: connection.tenantId,
            };

            contentCollection.insertOne(dbMessage).then(() => {
                socket.broadcastToRoom(roomMap.get(clientId), "op-content", broadCastMessage);
                return response(null);
            }, (error) => {
                if (error.code !== 11000) {
                    return response("Could not write to DB", null);
                }
            });
        });

        // Message sent when a new signal is submitted to the router
        socket.on("submitSignal", (clientId: string, contents: any[], response) => {
            // Verify the user has connected on this object id
            if (!roomMap.has(clientId)) {
                return response("Invalid client ID", null);
            }

            const roomId = roomMap.get(clientId);

            for (const content of contents) {
                const signalMessage: ISignalMessage = {
                    clientId,
                    content,
                };

                socket.emitToRoom(roomId, "signal", signalMessage);
            }

            response(null);
        });

        socket.on("disconnect", () => {
            // Send notification messages for all client IDs in the connection map
            for (const connection of connectionsMap.values()) {
                connection.disconnect();
            }
        });
    });
}
