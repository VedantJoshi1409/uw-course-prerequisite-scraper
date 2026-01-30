const { firefox } = require("playwright");
const fs = require("fs");

(async () => {
  const browser = await firefox.launch({ headless: false });
  const page = await browser.newPage();

  // Read subject links
  const subjectLinks = JSON.parse(fs.readFileSync("subject_links.json", "utf-8"));
  console.log(`Found ${subjectLinks.length} subjects to process`);

  const allCourseLinks = {};

  for (let i = 0; i < subjectLinks.length; i++) {
    const subject = subjectLinks[i];

    // Extract subject name from URL
    const urlParams = new URL(subject.href).hash.split("?")[1];
    const groupParam = new URLSearchParams(urlParams).get("group");
    const subjectName = decodeURIComponent(groupParam);

    console.log(`[${i + 1}/${subjectLinks.length}] Processing: ${subjectName}`);

    await page.goto(subject.href, { waitUntil: "networkidle" });

    // Wait for the content to load
    await page.waitForSelector("div.style__collapsibleBox___DBqEP", { timeout: 10000 }).catch(() => {
      console.log(`  No collapsible boxes found for ${subjectName}`);
    });

    // Get all links from divs with class "style__collapsibleBox___DBqEP"
    const links = await page.$$eval(
      "div.style__collapsibleBox___DBqEP a",
      (anchors) => anchors.map((a) => ({
        href: a.href,
        text: a.textContent.trim()
      }))
    );

    allCourseLinks[subjectName] = links;
    console.log(`  Found ${links.length} course links`);

    // Small delay to be polite to the server
    await page.waitForTimeout(500);
  }

  // Save all course links to file
  fs.writeFileSync("course_links.json", JSON.stringify(allCourseLinks, null, 2));
  console.log(`\nDone! Saved course links for ${Object.keys(allCourseLinks).length} subjects to course_links.json`);

  await browser.close();
})();
