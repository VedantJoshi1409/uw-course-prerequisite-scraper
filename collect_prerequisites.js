const { firefox } = require("playwright");
const fs = require("fs");

(async () => {
  const browser = await firefox.launch({ headless: false });
  const page = await browser.newPage();

  // Read course links
  const courseLinks = JSON.parse(fs.readFileSync("course_links.json", "utf-8"));
  const subjects = Object.keys(courseLinks);

  // Load existing progress if any
  let coursePrerequisites = {};
  if (fs.existsSync("prerequisites.json")) {
    coursePrerequisites = JSON.parse(
      fs.readFileSync("prerequisites.json", "utf-8"),
    );
    console.log(
      `Loaded ${Object.keys(coursePrerequisites).length} existing courses from prerequisites.json`,
    );
  }

  console.log(`Found ${subjects.length} subjects to process`);

  for (let s = 0; s < subjects.length; s++) {
    const subject = subjects[s];
    const courses = courseLinks[subject];

    console.log(
      `\n[Subject ${s + 1}/${subjects.length}] ${subject} (${courses.length} courses)`,
    );

    for (let i = 0; i < courses.length; i++) {
      const course = courses[i];
      const courseCode = course.text.split(" - ")[0]; // e.g., "AFM101"

      // Skip if already processed
      if (coursePrerequisites[courseCode]) {
        console.log(
          `  [${i + 1}/${courses.length}] Skipping ${courseCode} (already processed)`,
        );
        continue;
      }

      console.log(`  [${i + 1}/${courses.length}] Processing: ${course.text}`);

      try {
        await page.goto(course.href, { waitUntil: "networkidle" });

        // Wait for the specific course to appear on the page
        await page.waitForFunction(
          (code) => {
            const text = document.body.innerText;
            // Check for both "AFM101" and "AFM 101" formats
            const withSpace = code.replace(/([A-Z]+)(\d+)/, "$1 $2");
            return text.includes(code) || text.includes(withSpace);
          },
          courseCode,
          { timeout: 10000 }
        );

        // Extra delay to ensure React has fully rendered
        await page.waitForTimeout(500);

        // Find prerequisites - look for h3 with "Prerequisites" and get all links in its container
        const prerequisites = await page.evaluate(() => {
          // Find the Prerequisites header
          const headers = Array.from(document.querySelectorAll("h3"));
          const prereqHeader = headers.find(
            (h) => h.textContent.trim() === "Prerequisites",
          );

          if (!prereqHeader) {
            return null;
          }

          // Find the parent container that holds the prerequisites section
          const container =
            prereqHeader.closest("div") || prereqHeader.parentElement;

          if (!container) {
            return null;
          }

          // Get all links in the container
          const links = container.querySelectorAll("a");
          const linkContents = Array.from(links)
            .map((link) => link.textContent.trim())
            .filter((text) => /^[A-Z]{1,10}\d{3}[A-Z]*$/.test(text));

          return [...new Set(linkContents)];
        });

        if (prerequisites && prerequisites.length > 0) {
          coursePrerequisites[courseCode] = {
            name: course.text,
            subject: subject,
            prerequisites: prerequisites,
          };
          console.log(`    Found prerequisites: ${prerequisites.join(", ")}`);
        } else {
          coursePrerequisites[courseCode] = {
            name: course.text,
            subject: subject,
            prerequisites: [],
          };
          console.log(`    No prerequisites found`);
        }
      } catch (err) {
        console.log(`    Error: ${err.message}`);
        coursePrerequisites[courseCode] = {
          name: course.text,
          subject: subject,
          prerequisites: [],
          error: err.message,
        };
      }

      // Small delay to be polite to the server
      await page.waitForTimeout(300);
    }

    // Save after each subject completes
    fs.writeFileSync(
      "prerequisites.json",
      JSON.stringify(coursePrerequisites, null, 2),
    );
    console.log(
      `  Saved progress (${Object.keys(coursePrerequisites).length} courses total)`,
    );
  }

  console.log(
    `\nDone! Saved prerequisites for ${Object.keys(coursePrerequisites).length} courses to prerequisites.json`,
  );

  await browser.close();
})();
