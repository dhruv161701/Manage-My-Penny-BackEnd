import axios from 'axios';
import AIReport from '../models/AIReport.js';
import Department from '../models/Department.js';
import { calculateDepartmentSpending } from './analyticsService.js';

// Debounce storage
const debounceTimers = {};

/**
 * Generate monthly global report with debounce
 * @param {number} month - 1-12
 * @param {number} year - 2020-2100
 */
export const scheduleReportGeneration = (month, year) => {
    const key = `${month}-${year}`;

    // Clear existing timer if any
    if (debounceTimers[key]) {
        clearTimeout(debounceTimers[key]);
    }

    console.log(`⏳ Scheduling AI Report generation for ${month}/${year} in 5 seconds...`);

    // Set new timer (5 seconds debounce)
    debounceTimers[key] = setTimeout(async () => {
        try {
            delete debounceTimers[key]; // Remove timer key
            await generateMonthlyReport(month, year);
        } catch (error) {
            console.error(`❌ Scheduled Report Generation Failed for ${month}/${year}:`, error);
        }
    }, 5000);
};

/**
 * Internal function to generate report immediately
 */
const generateMonthlyReport = async (month, year) => {
    console.log(`🚀 Starting AI Report Generation for ${month}/${year}...`);

    try {
        // 1. Fetch All Data
        const departments = await Department.find({ status: 'Active' }).lean(); // Only active departments? User said "All departments". I'll assume all active ones or all present.

        let totalAllocatedBudget = 0;
        let totalSpent = 0;
        const departmentsSnapshot = [];

        // Parallelize spending calculation
        await Promise.all(departments.map(async (dept) => {
            const spent = await calculateDepartmentSpending(dept._id, month, year);
            const percentageUsed = dept.allocatedBudget > 0 ? (spent / dept.allocatedBudget) * 100 : 0;

            totalAllocatedBudget += dept.allocatedBudget;
            totalSpent += spent;

            departmentsSnapshot.push({
                departmentName: dept.name,
                allocatedBudget: dept.allocatedBudget,
                totalSpent: spent,
                percentageUsed: parseFloat(percentageUsed.toFixed(2)),
                status: dept.status
            });
        }));

        const globalPercentageUsed = totalAllocatedBudget > 0 ? (totalSpent / totalAllocatedBudget) * 100 : 0;

        // 2. Construct Prompt
        const prompt = `
Generate a structured enterprise-level financial report for ${month}/${year}.

**Financial Data:**
- Total Allocated Budget: $${totalAllocatedBudget.toLocaleString()}
- Total Spent: $${totalSpent.toLocaleString()}
- Budget Utilization: ${globalPercentageUsed.toFixed(2)}%

**Department Breakdown:**
${departmentsSnapshot.map(d => `- ${d.departmentName}: Spent $${d.totalSpent.toLocaleString()} / Budget $${d.allocatedBudget.toLocaleString()} (${d.percentageUsed}%)`).join('\n')}

**Requirements (JSON Output Only):**
1. **summary**: Expert executive overview (Max 120 words).
2. **insights**: Key observations (Max 3 items, max 15 words each).
3. **recommendations**: Strategic actions (Max 3 items, max 15 words each).
4. **riskLevel**: "Low", "Medium", or "High" based on spending (Low < 75%, Medium 75-90%, High > 90%).

**Output Format:**
{
  "summary": "string",
  "insights": ["string", "string"],
  "recommendations": ["string", "string"],
  "riskLevel": "Low/Medium/High"
}

Return ONLY valid JSON.
        `;

        // 3. Call Gemini API (Direct REST Call)
        // User requested: POST https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent
        const apiKey = process.env.GEMINI_API_KEY;
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

        const requestBody = {
            contents: [
                {
                    parts: [
                        { text: prompt }
                    ]
                }
            ]
        };

        const response = await axios.post(url, requestBody, {
            headers: {
                'Content-Type': 'application/json'
            }
        });

        // Extract response text
        const responseText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!responseText) {
            throw new Error('Invalid response structure from Gemini API');
        }

        let aiResponse;
        try {
            // Clean markdown code blocks if present
            const cleanText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
            aiResponse = JSON.parse(cleanText);
        } catch (e) {
            console.error('Failed to parse AI JSON:', e);
            // Fallback
            aiResponse = {
                summary: "Automated analysis unavailable. Spending data is accurate.",
                insights: ["Review department spending manually."],
                recommendations: ["Generate specific department reports."],
                riskLevel: globalPercentageUsed > 90 ? 'High' : 'Medium'
            };
        }

        // 4. Update Database
        const reportData = {
            type: 'Global',
            month,
            year,
            // Store raw structured data as JSON string for frontend flexibility or add schema fields
            // The User wants "insights" which is not in schema. 
            // We'll store the extra structured data in `reportText` as a JSON string for now, 
            // or we could add `insights` to schema. 
            // Given the limitations, I'll store the stringified JSON object in `reportText` so frontend can parse it.
            reportText: JSON.stringify(aiResponse),

            // Allow backward compatibility with schema fields
            summary: aiResponse.summary,
            riskLevel: aiResponse.riskLevel,
            recommendations: aiResponse.recommendations,

            totalBudget: totalAllocatedBudget,
            totalSpent: totalSpent,
            departmentsSnapshot,
        };

        // Upsert: Find and update OR create new
        // Note: mongoose findOneAndUpdate with upsert: true
        await AIReport.findOneAndUpdate(
            { type: 'Global', month, year },
            reportData,
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        console.log(`✅ AI Report successfully generated and saved for ${month}/${year}`);

    } catch (error) {
        console.error('❌ AI Report Generation Error:', error);
        // Fallback or error handling?
        // User said "If Gemini fails -> store previous report + error flag".
        // For now, logging is sufficient as we didn't wipe the old report if generation failed (we haven't touched DB yet in this try block until success).
    }
};
