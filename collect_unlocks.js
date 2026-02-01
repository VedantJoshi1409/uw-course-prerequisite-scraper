const fs = require('fs');

// Load courses data
const courses = JSON.parse(fs.readFileSync('courses.json', 'utf8'));

// Build unlocks map: for each course, track which courses it unlocks
const unlocksMap = {};

// Initialize empty unlocks arrays for all courses
for (const courseId of Object.keys(courses)) {
    unlocksMap[courseId] = [];
}

// For each course A with prerequisites, add A to each prerequisite B's unlocks
for (const [courseId, course] of Object.entries(courses)) {
    if (course.prerequisites && course.prerequisites.length > 0) {
        for (const prereq of course.prerequisites) {
            // Only add if the prerequisite course exists in our data
            if (unlocksMap[prereq] !== undefined) {
                unlocksMap[prereq].push(courseId);
            }
        }
    }
}

// Add unlocks to each course
for (const courseId of Object.keys(courses)) {
    courses[courseId].unlocks = unlocksMap[courseId];
}

// Save updated courses
fs.writeFileSync('courses.json', JSON.stringify(courses, null, 2));

// Print summary stats
let totalUnlocks = 0;
let coursesWithUnlocks = 0;
for (const courseId of Object.keys(courses)) {
    const unlockCount = courses[courseId].unlocks.length;
    totalUnlocks += unlockCount;
    if (unlockCount > 0) coursesWithUnlocks++;
}

console.log(`Updated ${Object.keys(courses).length} courses`);
console.log(`${coursesWithUnlocks} courses unlock at least one other course`);
console.log(`Total unlock relationships: ${totalUnlocks}`);
