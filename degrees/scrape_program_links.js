const { firefox } = require("playwright");
const fs = require("fs");
const path = require("path");
const DATA_DIR = path.join(__dirname, "..", "data");

(async () => {
  const browser = await firefox.launch({ headless: false });
  const page = await browser.newPage();

  await page.goto(
    "https://uwaterloo.ca/academic-calendar/undergraduate-studies/catalog#/programs",
    { waitUntil: "networkidle" },
  );

  await page.waitForSelector("div.style__collapsibleBox___DBqEP", { timeout: 15000 });

  console.log("Programs page loaded");

  // Click all collapsible box headers to expand them
  const headers = await page.$$("div.style__collapsibleBox___DBqEP");
  console.log(`Found ${headers.length} collapsible sections, expanding...`);

  for (const header of headers) {
    await header.click();
    await page.waitForTimeout(100);
  }

  // Wait for all sections to finish expanding
  await page.waitForTimeout(1000);

  // Scrape only links whose text contains "Bachelor of"
  const links = await page.$$eval(
    "div.ReactCollapse--collapse a",
    (anchors) =>
      anchors
        .filter((a) => a.textContent.includes("Bachelor of"))
        .map((a) => ({
          href: a.href,
          text: a.textContent.trim(),
        })),
  );

  console.log(`Found ${links.length} Bachelor programs`);
  console.log(JSON.stringify(links, null, 2));

  fs.writeFileSync(path.join(DATA_DIR, "degree_program_urls.json"), JSON.stringify(links, null, 2));
  console.log("Saved to degree_program_urls.json");

  await browser.close();
})();
