const { firefox } = require("playwright");
const fs = require("fs");
const path = require("path");
const DATA_DIR = path.join(__dirname, "..", "data");

(async () => {
  const browser = await firefox.launch({ headless: false });
  const page = await browser.newPage();

  await page.goto(
    "https://uwaterloo.ca/academic-calendar/undergraduate-studies/catalog#/courses",
    { waitUntil: "networkidle" },
  );

  // Wait for React app to hydrate
  await page.waitForSelector("text=Courses");

  console.log("Calendar loaded");

  // Get all links from divs with class "style__collapsibleBox___DBqEP"
  const links = await page.$$eval(
    "div.style__collapsibleBox___DBqEP a",
    (anchors) =>
      anchors.map((a) => ({
        href: a.href,
        text: a.textContent.trim(),
      })),
  );

  console.log(`Found ${links.length} links:`);
  console.log(JSON.stringify(links, null, 2));

  // Save links to file
  fs.writeFileSync(path.join(DATA_DIR, "course_subject_urls.json"), JSON.stringify(links, null, 2));
  console.log("Links saved to course_subject_urls.json");

  await browser.close();
})();
