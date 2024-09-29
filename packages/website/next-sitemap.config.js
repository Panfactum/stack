module.exports = {
  siteUrl: process.env.SITE_URL || "https://panfactum.com",
  generateRobotsTxt: true, // (optional)
  sourceDir: "build",
  exclude: ["/docs/main/*", "/changelog/main"],
  autoLastmod: false,
  changefreq: null,
  priority: null,
};
