import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isProd = process.env.NODE_ENV === 'production';
const PORT = 3000;

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '25mb' }));

  const apiKey = process.env.GEMINI_API_KEY;
  const ai = new GoogleGenAI({
    apiKey: apiKey || '',
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      hasApiKey: Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY'),
    });
  });

  // Comprehensive Trend & Dataset Analysis
  app.post('/api/ai/analyze', async (req, res) => {
    try {
      const { schema, sampleData, summaryStats, userPrompt, targetColumn, timeColumn } = req.body;

      if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
        return res.status(400).json({
          error: 'GEMINI_API_KEY is not configured in the environment. Please configure it in Settings > Secrets.',
        });
      }

      const prompt = `You are a Principal Data Scientist and Business Intelligence Specialist providing real-time data analysis.

Dataset Details:
- Columns: ${JSON.stringify(schema)}
- Target Value Column for Analysis: ${targetColumn || 'Auto-detected'}
- Time/Ordering Column: ${timeColumn || 'None / Row Order'}
- Total Filtered Rows: ${summaryStats?.rowCount || 'N/A'}
- Numeric Stats Summary:
${JSON.stringify(summaryStats?.numericMetrics || {}, null, 2)}
- Sample Data (first 6 rows):
${JSON.stringify(sampleData || [], null, 2)}

User Custom Focus / Request:
"${userPrompt || 'Analyze trends, growth trajectory, anomalies, key metric swings, and strategic takeaways.'}"

Provide a structured, insightful analysis with the following markdown sections:
### 1. Executive Trend & Momentum Summary
Summarize the key trajectory (upward/downward/cyclical), velocity, overall health, and major inflection points.

### 2. Deep-Dive Metrics & Growth Drivers
Analyze specific numbers, ranges, averages, standard deviations, and what variables appear to drive performance.

### 3. Anomaly & Outlier Watch
Identify notable spikes, dips, extreme values, or inconsistencies in the data and what might have caused them.

### 4. Correlation & Relationship Insights
Examine how primary variables interact (e.g. how volume affects revenue, cost vs profit, time progression).

### 5. Actionable Recommendations
Provide 3-4 concrete, data-backed operational or strategic decisions based on these findings.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          systemInstruction: 'You are an elite Streamlit-style data analytics intelligence engine. Deliver concise, punchy, mathematically grounded insights with bold headers, bullet points, and data citations.',
        },
      });

      res.json({ text: response.text });
    } catch (err: any) {
      console.error('Gemini analyze error:', err);
      res.status(500).json({ error: err.message || 'Failed to generate trend analysis' });
    }
  });

  // Interactive AI Assistant Chat
  app.post('/api/ai/chat', async (req, res) => {
    try {
      const { message, schema, summaryStats, sampleData, chatHistory } = req.body;

      if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
        return res.status(400).json({
          error: 'GEMINI_API_KEY is not configured in the environment.',
        });
      }

      const context = `You are TrendAI, an intelligent conversational data assistant embedded inside a real-time CSV analytics workspace.
Current Filtered Data Summary:
- Rows: ${summaryStats?.rowCount || 'N/A'}
- Columns: ${JSON.stringify(schema?.map((c: any) => `${c.name} (${c.type})`))}
- Numeric Summary: ${JSON.stringify(summaryStats?.numericMetrics || {})}
- Categorical Distributions: ${JSON.stringify(summaryStats?.categoricalTopValues || {})}
- First few sample rows: ${JSON.stringify(sampleData?.slice(0, 5) || [])}

Conversation History:
${(chatHistory || []).map((h: any) => `${h.role === 'user' ? 'User' : 'Assistant'}: ${h.content}`).join('\n')}

User's Question: "${message}"

Answer directly, accurately, and quantitatively. Mention specific columns, values, averages, and rates when available. If user asks how to visualize or filter something, suggest the exact setting in the sidebar.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: context,
      });

      res.json({ answer: response.text });
    } catch (err: any) {
      console.error('Gemini chat error:', err);
      res.status(500).json({ error: err.message || 'Failed to chat with AI' });
    }
  });

  // Forensic AI Anomaly Explainer
  app.post('/api/ai/explain-anomaly', async (req, res) => {
    try {
      const { anomaly, targetColumn, timeColumn, summaryStats, surroundingRows } = req.body;

      if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
        return res.status(400).json({
          error: 'GEMINI_API_KEY is not configured in the environment.',
        });
      }

      const prompt = `You are a Senior Quantitative Analyst investigating a detected anomaly in a dataset.

Anomaly Details:
- Target Metric: "${targetColumn}"
- Observed Value: ${anomaly?.yValue}
- Expected Value / Baseline Mean: ${anomaly?.expectedValue}
- Z-Score: ${anomaly?.zScore} (standard deviations from mean)
- Time/Identifier: ${anomaly?.xValue}
- Full Row Record:
${JSON.stringify(anomaly?.row || {}, null, 2)}

Overall Dataset Summary:
- Total Filtered Rows: ${summaryStats?.rowCount}
- Metric Stats: ${JSON.stringify(summaryStats?.numericMetrics?.[targetColumn] || {})}

Surrounding Records Context:
${JSON.stringify(surroundingRows || [], null, 2)}

Provide a concise forensic breakdown (3 short bullet points):
1. **Deviation Severity & Magnitude**: How extreme this spike/drop is compared to typical variance.
2. **Key Contributing Columns/Factors**: Look across the other columns in this row (e.g. discounts, categories, spikes in other fields) and explain what correlated or drove this unusual value.
3. **Actionable Analyst Note**: What the business or engineering team should investigate or do about it.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          systemInstruction: 'You are an expert quantitative data scientist. Deliver concise, forensic, mathematically precise anomaly explanations.',
        },
      });

      res.json({ explanation: response.text });
    } catch (err: any) {
      console.error('Gemini anomaly explanation error:', err);
      res.status(500).json({ error: err.message || 'Failed to generate anomaly explanation' });
    }
  });

  // AI-Powered Streamlit Python Application Generator & Customizer
  app.post('/api/ai/generate-streamlit', async (req, res) => {
    try {
      const { datasetName, columns, currentConfig, sampleRows, userInstructions } = req.body;

      if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
        return res.status(400).json({
          error: 'GEMINI_API_KEY is not configured in the environment.',
        });
      }

      const prompt = `You are an elite Senior Python & Streamlit Developer and Principal Data Scientist.
Create a production-ready, clean, 100% executable Streamlit Python application (app.py).

Dataset Information:
- Dataset Name: "${datasetName || 'Dataset'}"
- Columns: ${JSON.stringify(columns?.map((c: any) => ({ name: c.name, type: c.type })))}
- Default X Axis: "${currentConfig?.xAxis || columns?.[0]?.name}"
- Default Y Axis (Metric): "${currentConfig?.yAxis || columns?.[1]?.name}"
- Moving Average Window: ${currentConfig?.movingAverageWindow || 7}
- Anomaly Threshold: ${currentConfig?.anomalyThreshold || 2.0}
- Sample Data (first 5 rows):
${JSON.stringify(sampleRows || [], null, 2)}

User Custom Request / Instructions:
"${userInstructions || 'Create a robust, error-free interactive Streamlit dashboard matching this dataset with sidebar filters, KPI cards, Plotly trend & moving average, and pure-pandas anomaly detection.'}"

CRITICAL REQUIREMENTS:
1. Output ONLY the raw executable Python code. Do NOT wrap in markdown backticks (\`\`\`python ... \`\`\`) if possible, or only pure code.
2. Must run without ANY syntax or runtime errors with 'streamlit run app.py'.
3. Include an embedded CSV string or sample DataFrame using standard Python types (use None, True, False, never JS null or lowercase true).
4. Provide a 'st.sidebar.file_uploader("Upload CSV", type=["csv"])' so users can upload their own CSV file or use the embedded default dataset.
5. In the sidebar, create dynamic reactive filters (range sliders for numeric columns, multiselect for categorical columns).
6. In the main view:
   - Multi-metric KPI row with st.metric (Total, Mean, Median, Std Dev).
   - Plotly chart with Moving Average (SMA) line and interactive Z-score anomaly points.
   - Tabs for "Interactive Chart", "Data Explorer (st.dataframe)", and "Correlation Heatmap".
7. Make sure all pandas operations handle empty filtered data gracefully with 'if not filtered_df.empty:'.
8. Ensure dependencies are strictly standard: streamlit, pandas, plotly, numpy.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          systemInstruction: 'You are an elite Streamlit engineer. Generate clean, robust, production-grade Python code that executes without errors.',
        },
      });

      let code = response.text || '';
      // Strip markdown code fences if Gemini added them
      code = code.replace(/^```(?:python)?\n?/i, '').replace(/\n?```$/i, '').trim();

      res.json({ code });
    } catch (err: any) {
      console.error('Gemini generate-streamlit error:', err);
      res.status(500).json({ error: err.message || 'Failed to generate Streamlit code' });
    }
  });

  // Natural Language to Filter & Chart Setup
  app.post('/api/ai/nl-filter', async (req, res) => {
    try {
      const { naturalQuery, columns } = req.body;

      if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
        return res.status(400).json({
          error: 'GEMINI_API_KEY is not configured.',
        });
      }

      const prompt = `You are a query-to-filter parser for a data analytics dashboard.
Available Columns and their inferred types:
${JSON.stringify(columns, null, 2)}

User Natural Language Request:
"${naturalQuery}"

Return a JSON object conforming strictly to this format:
{
  "explanation": "Short 1-sentence explanation of applied filter and chart configuration",
  "suggestedChartType": "line" | "bar" | "scatter" | "area" | "histogram",
  "suggestedX": "exact column name for X axis or null",
  "suggestedY": "exact column name for Y axis or null",
  "filters": [
    {
      "column": "exact column name",
      "operator": ">" | ">=" | "<" | "<=" | "==" | "!=" | "contains",
      "value": "string or number"
    }
  ]
}
Do not wrap in markdown or backticks if possible, return valid JSON.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
        },
      });

      let parsed = {};
      try {
        parsed = JSON.parse(response.text || '{}');
      } catch (parseErr) {
        parsed = { explanation: response.text };
      }

      res.json(parsed);
    } catch (err: any) {
      console.error('Gemini NL filter error:', err);
      res.status(500).json({ error: err.message || 'Failed to parse natural language query' });
    }
  });

  // Vite middleware in dev, static in prod
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`TrendAI Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(console.error);
