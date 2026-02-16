const { firefox } = require("playwright");
const fs = require("fs");
const path = require("path");
const DATA_DIR = path.join(__dirname, "..", "data");

(async () => {
  const browser = await firefox.launch({ headless: false });
  const page = await browser.newPage();

  const programLinks = JSON.parse(fs.readFileSync(path.join(DATA_DIR, "degree_program_urls.json"), "utf-8"));

  // Load existing progress if any
  let programRequirements = {};
  if (fs.existsSync(path.join(DATA_DIR, "degree_requirements.json"))) {
    programRequirements = JSON.parse(fs.readFileSync(path.join(DATA_DIR, "degree_requirements.json"), "utf-8"));
    console.log(`Loaded ${Object.keys(programRequirements).length} existing programs from degree_requirements.json`);
  }

  console.log(`Found ${programLinks.length} programs to process`);

  for (let i = 0; i < programLinks.length; i++) {
    const program = programLinks[i];

    // Skip if already processed
    if (programRequirements[program.text]) {
      console.log(`[${i + 1}/${programLinks.length}] Skipping ${program.text} (already processed)`);
      continue;
    }

    console.log(`[${i + 1}/${programLinks.length}] Processing: ${program.text}`);

    try {
      await page.goto(program.href, { waitUntil: "networkidle" });
      await page.waitForTimeout(2000);

      const requirements = await page.evaluate(() => {
        // Find the "Course Requirements" h3
        const headers = Array.from(document.querySelectorAll("h3"));
        const courseReqHeader = headers.find(h => h.textContent.trim() === "Course Requirements");
        if (!courseReqHeader) return null;

        // The requirements section is the next sibling container
        const section = courseReqHeader.nextElementSibling;
        if (!section) return null;

        const courseCodePattern = /^[A-Z]{1,10}\d{3}[A-Z]*$/;

        // Extract amount from text like "Complete all...", "Complete 3 of...", "Choose any..."
        function parseAmount(text) {
          if (/Complete all|Choose all/i.test(text)) return "all";
          if (/Choose any/i.test(text)) return "all";
          const numMatch = text.match(/Complete\s+(\d+)/i);
          if (numMatch) return parseInt(numMatch[1]);
          return null;
        }

        // Parse a single <li> into either a course code, a text string, or a requirement object
        function parseLi(li) {
          const div = li.querySelector(":scope > div");
          if (!div) {
            // li with just a span/link (e.g. a course link directly)
            const link = li.querySelector("a");
            if (link && courseCodePattern.test(link.textContent.trim())) {
              return link.textContent.trim();
            }
            const text = li.textContent.trim();
            return text || null;
          }

          const text = div.textContent.trim();
          const amount = parseAmount(text);
          const nestedUl = div.querySelector("ul");

          if (amount !== null && nestedUl) {
            // This is a structured requirement with a list of options
            const options = parseOptions(nestedUl);
            const resolvedAmount = amount === "all" ? options.length : amount;
            return { amount: resolvedAmount, options };
          }

          // Everything else is a free-text rule (e.g. "Complete 4 additional CS courses...",
          // "The following cannot be used: ...", etc.)
          return text;
        }

        // Recursively parse a <ul> into requirement objects
        function parseUl(ul) {
          // Get all <li> descendants, including those wrapped in <div> section labels
          const items = Array.from(ul.querySelectorAll(":scope > li, :scope > div > li"));
          const results = [];

          for (const li of items) {
            // Check if this li is a "Complete X of the following" wrapper with nested <ul>
            const span = li.querySelector(":scope > span");
            const amount = span ? parseAmount(span.textContent) : null;
            if (amount !== null) {
              const nestedUl = li.querySelector(":scope > ul");
              if (nestedUl) {
                if (amount === "all") {
                  // "Complete all" is just a passthrough — flatten its children
                  results.push(...parseUl(nestedUl));
                } else {
                  // "Complete N of the following" is a real requirement group
                  const options = parseUl(nestedUl);
                  results.push({ amount, options });
                }
                continue;
              }
            }

            const parsed = parseLi(li);
            if (parsed !== null) {
              results.push(parsed);
            }
          }

          return results;
        }

        // Parse the options inside a requirement's <ul>
        function parseOptions(ul) {
          const items = Array.from(ul.children).filter(el => el.tagName === "LI");
          const options = [];

          for (const li of items) {
            const parsed = parseLi(li);
            if (parsed !== null) {
              options.push(parsed);
            }
          }

          return options;
        }

        // Find the first <ul> in the section
        const rootUl = section.querySelector("ul");
        if (!rootUl) return null;

        return parseUl(rootUl);
      });

      programRequirements[program.text] = {
        name: program.text,
        href: program.href,
        requirements: requirements || [],
      };

      const reqCount = requirements ? requirements.length : 0;
      console.log(`  Found ${reqCount} requirement group(s)`);

    } catch (err) {
      console.log(`  Error: ${err.message}`);
      programRequirements[program.text] = {
        name: program.text,
        href: program.href,
        requirements: [],
        error: err.message,
      };
    }

    await page.waitForTimeout(300);

    // Save after each program
    fs.writeFileSync(
      path.join(DATA_DIR, "degree_requirements.json"),
      JSON.stringify(programRequirements, null, 2),
    );
    console.log(`  Saved progress (${Object.keys(programRequirements).length} programs total)`);
  }

  console.log(`\nDone! Saved requirements for ${Object.keys(programRequirements).length} programs to degree_requirements.json`);

  await browser.close();
})();
