"use strict";

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
require("@rushstack/eslint-patch/modern-module-resolution");

module.exports = {
  extends: ["@saberhq"],
  parserOptions: {
    tsconfigRootDir: __dirname,
    project: "tsconfig.json",
  },
};
