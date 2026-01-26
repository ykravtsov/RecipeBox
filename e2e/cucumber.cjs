module.exports = {
  default: {
    require: ["features/**/*.js"],
    format: ["@cucumber/pretty-formatter", "html:cucumber-report.html"],
    formatOptions: {
      snippetInterface: "async-await",
    },
    paths: ["features/**/*.feature"],
    publishQuiet: true,
    timeout: 60000,
  },
};
