/*!
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

module.exports = {
    "ignorePatterns": ["src/prosemirror.ts", "src/index.ts", "src/fluidCollabManager.ts", "src/prosemirrorView.tsx", "src/storage/storageUtil.ts", "src/storage/storageAccount.ts", "src/utils/*"],
    "extends": [
        "@fluidframework/eslint-config-fluid/eslint7"
    ],
    "rules": {
        "@typescript-eslint/no-use-before-define": "off",
        "@typescript-eslint/restrict-plus-operands": "off",
        "@typescript-eslint/strict-boolean-expressions": "off",
        "no-case-declarations": "off",
        "no-null/no-null": "off",
        "@typescript-eslint/no-unsafe-return": "off",
        "@typescript-eslint/quotes": "off",
        "@typescript-eslint/prefer-readonly": "off",
        "@typescript-eslint/comma-dangle": "off",
        "@typescript-eslint/semi": "off",
        "@typescript-eslint/consistent-type-assertions": "off",
        "max-len": "off",
        "no-trailing-spaces": "off",
        "space-before-blocks": "off",
        "padded-blocks": "off",
        "no-multiple-empty-lines": "off",
        "default-case": "off",
        "no-return-await": "off",
        "eol-last": "off"
    }
}
