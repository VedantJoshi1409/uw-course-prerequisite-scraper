const { firefox } = require("playwright");
const fs = require("fs");

(async () => {
  const browser = await firefox.launch({ headless: false });
  const page = await browser.newPage();

  await page.goto(
    "https://academic-calendar-archive.uwaterloo.ca/undergraduate-studies/2023-2024/page/Course-Descriptions-Index.html",
    { waitUntil: "networkidle" }
  );

  console.log("Archive page loaded");

  // Get all rows from the table with the specified style
  // Only extract column 2 (Subject Code) and column 3 (Owner/Faculty)
  const rows = await page.$$eval(
    'table[style="width: 100%;"][cellspacing="0"][cellpadding="1"][bordercolor="#c0c0c0"][border="1"] tr',
    (trs) =>
      trs
        .map((tr) => {
          const cells = Array.from(tr.querySelectorAll("td, th"));
          if (cells.length < 3) return null;
          const subjectCode = cells[1]?.textContent.trim();
          const faculty = cells[2]?.textContent.trim();
          // Skip header row and alphabet separator rows
          if (!subjectCode || subjectCode === "Subject Code") return null;
          return { subjectCode, faculty };
        })
        .filter((row) => row !== null && row.subjectCode)
  );

  console.log(`Found ${rows.length} subjects`);
  console.log(JSON.stringify(rows, null, 2));

  // Save rows to file
  fs.writeFileSync("faculties_archive.json", JSON.stringify(rows, null, 2));
  console.log("Rows saved to faculties_archive.json");

  await browser.close();
})();
