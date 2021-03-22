/*!
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

module.exports = {
    "ignorePatterns": ["src/test/test-component.ts","src/prosemirror.ts","src/deferred/Deferred.test.ts", "src/index.ts", "src/fluidCollabManager.ts", "src/prosemirrorView.tsx", "src/storage/storageUtil.ts", "src/storage/storageAccount.ts", "src/test/*"],
    "extends": [
        "@fluidframework/eslint-config-fluid/eslint7"
    ],
    "rules": {
        "@typescript-eslint/ban-types": "off",
        "@typescript-eslint/no-use-before-define": "off",
        "@typescript-eslint/restrict-plus-operands": "off",
        "@typescript-eslint/strict-boolean-expressions": "off",
        "@typescript-eslint/quotes": "off",
        "@typescript-eslint/no-empty-interface": "off",
        "@typescript-eslint/comma-dangle": "off",
        "@typescript-eslint/prefer-readonly": "off",
        "@typescript-eslint/no-floating-promises": "off",
        "@typescript-eslint/promise-function-async": "off",
        "@typescript-eslint/semi": "off",
        "@typescript-eslint/no-misused-promises": "off",
        "@typescript-eslint/consistent-type-assertions": "off",
        "@typescript-eslint/no-non-null-assertion": "off",
        "@typescript-eslint/no-unnecessary-type-assertion": "off",
        "@typescript-eslint/no-shadow": "off",
        "@typescript-eslint/ban-ts-comment": "off",
        "@typescript-eslint/no-unsafe-return": "off",
        "import/no-internal-modules": "off",
        "import/order": "off",
        "max-len": "off",
        "no-case-declarations": "off",
        "no-null/no-null": "off",
        "no-trailing-spaces": "off",
        "no-multiple-empty-lines": "off",
        "spaced-comment": "off",
        "prefer-const": "off",
        "object-shorthand": "off",
        "no-undef-init": "off",
        "eol-last": "off",
        "padded-blocks": "off",
        "space-before-blocks": "off"
    }
}
