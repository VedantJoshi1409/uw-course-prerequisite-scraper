require("dotenv").config();
const Anthropic = require("@anthropic-ai/sdk");
const fs = require("fs");

const client = new Anthropic();

// Read subject links from JSON
const subjectLinks = JSON.parse(fs.readFileSync("subject_links.json", "utf-8"));

// Extract subject codes from URLs (e.g., "Mathematics (MATH)" -> "MATH")
function extractSubjectCode(href) {
  const match = href.match(/\(([^)]+)\)$/);
  return match ? match[1] : null;
}

// Extract full subject name (e.g., "Mathematics (MATH)" -> "Mathematics")
function extractSubjectName(href) {
  const groupParam = decodeURIComponent(href.split("group=")[1] || "");
  const match = groupParam.match(/^(.+?)\s*\(/);
  return match ? match[1] : groupParam;
}

async function getFacultyForSubject(subjectCode, subjectName) {
  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    tools: [
      {
        type: "web_search_20250305",
        name: "web_search",
        max_uses: 3,
      },
    ],
    system: `You are determining which University of Waterloo faculty owns a subject code.
Use web search to find official University of Waterloo information about which faculty owns this subject.
You must choose exactly one of the following:
- Faculty of Mathematics
- Faculty of Engineering
- Faculty of Arts
- Faculty of Science
- Faculty of Environment
- Faculty of Health

If uncertain, say "UNKNOWN".
After searching, respond with ONLY valid JSON, no other text.`,
    messages: [
      {
        role: "user",
        content: `Search for which faculty owns the University of Waterloo subject code "${subjectCode}" (${subjectName}).
Look for official UWaterloo faculty pages listing their departments and subject codes.

After searching, return ONLY this JSON format:
{"faculty": "..."}`,
      },
    ],
  });

  try {
    // Find the text block in the response (may have web search results too)
    const textBlock = response.content.find((block) => block.type === "text");
    if (textBlock) {
      const text = textBlock.text.trim();
      const jsonMatch = text.match(/\{[\s\S]*?\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    }
  } catch (e) {
    console.error(
      `Failed to parse response for ${subjectCode}:`,
      JSON.stringify(response.content),
    );
  }
  return { faculty: "UNKNOWN" };
}

async function main() {
  const results = {};

  // Load existing results if any
  const outputFile = "subject_faculties.json";
  if (fs.existsSync(outputFile)) {
    const existing = JSON.parse(fs.readFileSync(outputFile, "utf-8"));
    Object.assign(results, existing);
  }

  for (const link of subjectLinks) {
    const subjectCode = extractSubjectCode(link.href);
    const subjectName = extractSubjectName(link.href);

    if (!subjectCode) {
      console.log(`Skipping invalid link: ${link.href}`);
      continue;
    }

    // Skip if already processed
    if (results[subjectCode]) {
      console.log(`Skipping ${subjectCode} (already processed)`);
      continue;
    }

    console.log(`Processing ${subjectCode} (${subjectName})...`);

    try {
      const result = await getFacultyForSubject(subjectCode, subjectName);
      results[subjectCode] = {
        name: subjectName,
        faculty: result.faculty,
      };

      // Save after each successful query (in case of interruption)
      fs.writeFileSync(outputFile, JSON.stringify(results, null, 2));
      console.log(`  -> ${result.faculty}`);

      // Small delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 500));
    } catch (error) {
      console.error(`Error processing ${subjectCode}:`, error.message);
    }
  }

  console.log(`\nDone! Results saved to ${outputFile}`);
}

main();
