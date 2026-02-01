const { firefox } = require("playwright");
const fs = require("fs");

(async () => {
  const browser = await firefox.launch({ headless: false });
  const page = await browser.newPage();

  // Read course links (already collected from subject pages)
  const courseLinks = JSON.parse(fs.readFileSync("course_links.json", "utf-8"));
  const subjects = Object.keys(courseLinks);

  // Load existing progress if any
  let courseExtras = {};
  if (fs.existsSync("course_extras.json")) {
    courseExtras = JSON.parse(fs.readFileSync("course_extras.json", "utf-8"));
    console.log(
      `Loaded ${Object.keys(courseExtras).length} existing courses from course_extras.json`,
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
      const titleText = course.text; // e.g., "AFM100 - Introduction to Experiential Learning"
      const courseCode = titleText.split(" - ")[0].trim();

      // Skip if already processed
      if (courseExtras[courseCode]) {
        console.log(
          `  [${i + 1}/${courses.length}] Skipping ${courseCode} (already processed)`,
        );
        continue;
      }

      console.log(`  [${i + 1}/${courses.length}] Processing: ${titleText}`);

      try {
        await page.goto(course.href, { waitUntil: "networkidle" });

        // Wait for the course view to load
        await page.waitForSelector("div.course-view__pre___iwNIQ", {
          timeout: 10000,
        });

        // Extra delay to ensure content has fully rendered
        await page.waitForTimeout(500);

        // Extract the description
        const description = await page
          .$eval("div.course-view__pre___iwNIQ", (div) =>
            div.textContent.trim(),
          )
          .catch(() => null);

        courseExtras[courseCode] = {
          title: titleText,
          subject: subject,
          description: description || "",
        };

        console.log(
          `    Description: ${description ? description.substring(0, 50) + "..." : "None found"}`,
        );
      } catch (err) {
        console.log(`    Error: ${err.message}`);
        courseExtras[courseCode] = {
          title: titleText,
          description: "",
          error: err.message,
        };
      }

      // Small delay to be polite to the server
      await page.waitForTimeout(50);
    }

    // Save after each subject completes
    fs.writeFileSync(
      "course_extras.json",
      JSON.stringify(courseExtras, null, 2),
    );
    console.log(
      `  Saved progress (${Object.keys(courseExtras).length} courses total)`,
    );
  }

  console.log(
    `\nDone! Saved extras for ${Object.keys(courseExtras).length} courses to course_extras.json`,
  );

  await browser.close();
})();
