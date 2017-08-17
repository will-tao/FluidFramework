import { Router } from "express";
import * as nconf from "nconf";

export function create(store: nconf.Provider): Router {
    const router: Router = Router();

    /**
     * Creates a new git repository
     */
    router.post("/repos", (request, response, next) => {
        return response.status(201).json({ });
    });

    /**
     * Retrieves an existing get repository
     */
    router.get("/repos/:repo", (request, response, next) => {
        return response.status(200).json({ });
    });

    return router;
}
