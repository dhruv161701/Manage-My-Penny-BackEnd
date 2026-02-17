import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Generate financial analysis using Gemini AI
 * @param {Object} departmentData - Financial data for analysis
 * @returns {Object} - Structured AI analysis
 */
export const generateFinancialAnalysis = async (departmentData) => {
    try {
        const {
            departmentName,
            allocatedBudget,
            totalSpent,
            remainingBudget,
            percentageUsed,
            previousMonthSpent,
            monthOverMonthChange,
            month,
            year,
            expenseBreakdown,
        } = departmentData;

        // Construct structured prompt
        const prompt = `You are a financial analysis assistant for an enterprise budget management system.

Analyze the following department financial data and provide a comprehensive report:

**Department:** ${departmentName}
**Period:** ${month}/${year}

**Budget Information:**
- Allocated Budget: $${allocatedBudget.toLocaleString()}
- Total Spent: $${totalSpent.toLocaleString()}
- Remaining Budget: $${remainingBudget.toLocaleString()}
- Percentage Used: ${percentageUsed.toFixed(2)}%

**Trend Analysis:**
- Previous Month Spent: $${previousMonthSpent.toLocaleString()}
- Month-over-Month Change: ${monthOverMonthChange >= 0 ? '+' : ''}${monthOverMonthChange.toFixed(2)}%

**Expense Breakdown by Category:**
${expenseBreakdown.map(cat => `- ${cat.category}: $${cat.total.toLocaleString()}`).join('\n')}

Please provide your analysis in the following JSON format:
{
  "summary": "A comprehensive 2-3 sentence summary of the department's financial status",
  "riskLevel": "Low, Medium, or High based on spending patterns",
  "recommendations": ["recommendation 1", "recommendation 2", "recommendation 3"]
}

**Guidelines:**
- Risk Level: Low (<75% spent), Medium (75-90% spent), High (>90% spent or overspending)
- Provide 3-5 actionable recommendations
- Focus on spending trends, budget utilization, and potential risks
- Be professional and concise

Return ONLY the JSON object, no additional text.`;

        // Get AI model
        const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

        // Generate content
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        // Parse JSON response
        let analysis;
        try {
            // Extract JSON from response (in case there's extra text)
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                analysis = JSON.parse(jsonMatch[0]);
            } else {
                throw new Error('No JSON found in response');
            }
        } catch (parseError) {
            console.error('Failed to parse AI response:', text);
            // Fallback analysis
            analysis = {
                summary: `The ${departmentName} department has spent ${percentageUsed.toFixed(2)}% of its allocated budget of $${allocatedBudget.toLocaleString()}.`,
                riskLevel: percentageUsed > 90 ? 'High' : percentageUsed > 75 ? 'Medium' : 'Low',
                recommendations: [
                    'Monitor spending closely to stay within budget',
                    'Review expense categories for optimization opportunities',
                    'Plan ahead for upcoming expenses',
                ],
            };
        }

        // Validate risk level
        if (!['Low', 'Medium', 'High'].includes(analysis.riskLevel)) {
            analysis.riskLevel = percentageUsed > 90 ? 'High' : percentageUsed > 75 ? 'Medium' : 'Low';
        }

        // Ensure recommendations is an array
        if (!Array.isArray(analysis.recommendations)) {
            analysis.recommendations = [analysis.recommendations];
        }

        return {
            success: true,
            data: analysis,
        };
    } catch (error) {
        console.error('Gemini AI Error:', error);
        return {
            success: false,
            message: 'Failed to generate AI analysis',
            error: error.message,
        };
    }
};

/**
 * Generate global financial analysis for admin
 * @param {Object} globalData - Aggregated financial data
 * @returns {Object} - Structured AI analysis
 */
export const generateGlobalAnalysis = async (globalData) => {
    try {
        const {
            totalBudget,
            totalSpent,
            percentageUsed,
            departmentBreakdown,
            monthlyTrend,
            month,
            year
        } = globalData;

        // Construct structured prompt
        const prompt = `You are a Chief Financial Officer (CFO) AI assistant for an enterprise.

Analyze the following company-wide financial data for ${month}/${year} and provide a strategic report:

**Overall Financial Status:**
- Total Budget: $${totalBudget.toLocaleString()}
- Total Spent: $${totalSpent.toLocaleString()}
- Percentage Used: ${percentageUsed.toFixed(2)}%

**Department Breakdown:**
${departmentBreakdown.map(dept => `- ${dept.departmentName}: $${dept.totalSpent.toLocaleString()} / $${dept.allocatedBudget.toLocaleString()} (${dept.percentageUsed.toFixed(1)}%)`).join('\n')}

**Monthly Spending Trend (Last 6 Months):**
${monthlyTrend.map(t => `- ${t.monthName}: $${t.spent.toLocaleString()}`).join('\n')}

Please provide your analysis in the following JSON format:
{
  "summary": "A strategic summary of the company's financial health and budget adherence.",
  "risks": [
    { "department": "Department Name", "riskLevel": "High/Medium/Low", "reason": "Reason for risk" }
  ],
  "suggestions": [
    "Specific actionable suggestion 1",
    "Specific actionable suggestion 2"
  ],
  "predictedNextMonthSpend": 12345.67,
  "optimizationTips": [
    "Tip regarding specific cost center",
    "Tip regarding allocation"
  ]
}

**Guidelines:**
- Identify departments overspending (>90%) as High Risk.
- Identify departments approaching limits (75-90%) as Medium Risk.
- Predict next month's spend based on the trend.
- Provide executive-level optimization tips.
- Return ONLY the JSON object.`;

        // Get AI model
        const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

        // Generate content
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        // Parse JSON response
        let analysis;
        try {
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                analysis = JSON.parse(jsonMatch[0]);
            } else {
                throw new Error('No JSON found');
            }
        } catch (parseError) {
            console.error('Failed to parse Global AI response:', text);
            // Fallback analysis
            analysis = {
                summary: `The company has spent ${percentageUsed.toFixed(2)}% of the total budget.`,
                risks: departmentBreakdown
                    .filter(d => d.percentageUsed > 75)
                    .map(d => ({
                        department: d.departmentName,
                        riskLevel: d.percentageUsed > 90 ? 'High' : 'Medium',
                        reason: `Utilization at ${d.percentageUsed.toFixed(1)}%`
                    })),
                suggestions: ['Review high-spending departments', 'Optimize budget allocation'],
                predictedNextMonthSpend: totalSpent * 1.05,
                optimizationTips: ['Analyze recurring expenses', 'Negotiate vendor contracts']
            };
        }

        return {
            success: true,
            data: analysis,
        };

    } catch (error) {
        console.error('Gemini AI Global Error:', error);
        return {
            success: false,
            message: 'Failed to generate global AI analysis',
            error: error.message,
        };
    }
};
