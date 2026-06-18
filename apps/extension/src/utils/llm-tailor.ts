/**
 * LLM-Powered Job Application Tailoring
 * 
 * Generates tailored cover letters and customizes resume content
 * for specific job descriptions using the OpenAI-compatible API.
 * 
 * Usage:
 *   const tailor = new LLMTailor({ apiKey: 'sk-...' });
 *   const coverLetter = await tailor.generateCoverLetter(jobDescription, profile);
 *   const tailoredResume = await tailor.tailorResume(jobDescription, resumeText);
 */

interface TailorConfig {
  apiKey?: string;
  apiEndpoint?: string;
  model?: string;
}

interface JobDescription {
  title: string;
  company: string;
  description: string;
  requirements?: string[];
  location?: string;
  url?: string;
}

interface GeneratedCoverLetter {
  subject: string;
  body: string;
  highlights: string[];
  fitScore: number; // 0-100
}

interface TailoredResumeSection {
  summary: string;
  tailoredBullets: string[];
  skillsHighlight: string[];
}

export class LLMTailor {
  private config: Required<TailorConfig>;

  constructor(config: TailorConfig = {}) {
    this.config = {
      apiKey: config.apiKey || '',
      apiEndpoint: config.apiEndpoint || 'https://api.openai.com/v1/chat/completions',
      model: config.model || 'gpt-4o-mini',
    };
  }

  /**
   * Set API key at runtime (e.g., from extension storage)
   */
  setApiKey(key: string): void {
    this.config.apiKey = key;
  }

  /**
   * Generate a tailored cover letter for a specific job
   */
  async generateCoverLetter(
    job: JobDescription,
    profile: {
      name: string;
      currentRole: string;
      yearsExperience: number;
      keySkills: string[];
      topAchievements: Array<{ title: string; bullets: string[] }>;
      education: { degree: string; school: string };
    }
  ): Promise<GeneratedCoverLetter> {
    if (!this.config.apiKey) {
      throw new Error('API key not configured. Call setApiKey() first.');
    }

    const prompt = this.buildCoverLetterPrompt(job, profile);

    try {
      const response = await this.callLLM(prompt);
      return this.parseCoverLetterResponse(response, job);
    } catch (error: any) {
      console.error('[LLMTailor] Cover letter generation failed:', error);
      // Fallback: generate template-based cover letter
      return this.generateFallbackCoverLetter(job, profile);
    }
  }

  /**
   * Tailor resume bullets for a specific job
   */
  async tailorResume(
    job: JobDescription,
    resumeExperience: Array<{ 
      company: string; 
      title: string; 
      bullets: string[];
      dates: string;
    }>
  ): Promise<Array<{ company: string; title: string; bullets: string[]; dates: string }>> {
    if (!this.config.apiKey) {
      // Return original if no API key
      return resumeExperience;
    }

    const prompt = this.buildResumeTailorPrompt(job, resumeExperience);

    try {
      const response = await this.callLLM(prompt);
      return this.parseResumeTailorResponse(response, resumeExperience);
    } catch (error: any) {
      console.error('[LLMTailor] Resume tailoring failed:', error);
      return resumeExperience;
    }
  }

  /**
   * Score how well a job matches the candidate's profile
   */
  async scoreJobFit(
    job: JobDescription,
    profile: {
      skills: string[];
      experience: Array<{ title: string; company: string; bullets: string[] }>;
    }
  ): Promise<{ score: number; reasoning: string; keyMatches: string[]; gaps: string[] }> {
    if (!this.config.apiKey) {
      return this.calculateBasicFitScore(job, profile);
    }

    const prompt = this.buildJobFitPrompt(job, profile);

    try {
      const response = await this.callLLM(prompt);
      return this.parseJobFitResponse(response);
    } catch {
      return this.calculateBasicFitScore(job, profile);
    }
  }

  // ─── Private Methods ───────────────────────────────────────────

  private async callLLM(prompt: string): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await fetch(this.config.apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: [
            { role: 'system', content: 'You are an expert career coach and resume writer. You write concise, impactful, truthful content. Never fabricate experience.' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.7,
          max_tokens: 2000,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`LLM API error (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      return data.choices?.[0]?.message?.content || '';
    } finally {
      clearTimeout(timeout);
    }
  }

  private buildCoverLetterPrompt(job: JobDescription, profile: any): string {
    return `Write a professional, tailored cover letter for the following job. Be specific and reference the job description.

JOB:
- Title: ${job.title}
- Company: ${job.company}
- Location: ${job.location || 'Remote'}
- Description: ${job.description}
${job.requirements ? `- Requirements: ${job.requirements.join(', ')}` : ''}

CANDIDATE:
- Name: ${profile.name}
- Current Role: ${profile.currentRole}
- Years of Experience: ${profile.yearsExperience}
- Key Skills: ${profile.keySkills.join(', ')}
- Education: ${profile.education.degree} from ${profile.education.school}
- Top Achievements:
${profile.topAchievements.map((a: any) => `  * ${a.title}: ${a.bullets.join('; ')}`).join('\n')}

Return a JSON response with:
{
  "subject": "Cover letter subject line",
  "body": "Full cover letter text, 3-4 paragraphs, professional but warm tone",
  "highlights": ["3-4 key selling points matched to the job"],
  "fitScore": 85
}

The cover letter should:
1. Open with enthusiasm for the specific role and company
2. Bridge 2-3 specific achievements to the job requirements
3. Show genuine understanding of the company's space
4. Close with a clear call to action

Return ONLY valid JSON, no markdown wrapping.`;
  }

  private buildResumeTailorPrompt(job: JobDescription, experience: any[]): string {
    const expText = experience.map(e => 
      `[${e.company} - ${e.title} (${e.dates})]\n${e.bullets.map((b: string) => `  - ${b}`).join('\n')}`
    ).join('\n\n');

    return `I'm applying for this job:

TITLE: ${job.title}
COMPANY: ${job.company}
DESCRIPTION: ${job.description}

Here are my current resume bullets for each role. For each role, rewrite the bullets to better emphasize skills relevant to this specific job. Do NOT fabricate experience — only rephrase and reorder what exists. Prioritize AI/ML/LLM-related achievements.

${expText}

Return a JSON object mapping company names to arrays of rewritten bullets:
{
  "Company Name": ["rewritten bullet 1", "rewritten bullet 2", ...]
}

Return ONLY valid JSON.`;
  }

  private buildJobFitPrompt(job: JobDescription, profile: any): string {
    return `Score how well this candidate fits the job on a scale of 0-100.

JOB:
- Title: ${job.title}
- Company: ${job.company}
- Description: ${job.description}

CANDIDATE:
- Skills: ${profile.skills.join(', ')}
- Experience:
${profile.experience.map((e: any) => `  * ${e.title} at ${e.company}: ${e.bullets.slice(0, 2).join('; ')}`).join('\n')}

Return JSON:
{
  "score": 85,
  "reasoning": "2-3 sentence explanation of the score",
  "keyMatches": ["specific matching skills/experience"],
  "gaps": ["any missing requirements"]
}

Return ONLY valid JSON.`;
  }

  private parseCoverLetterResponse(response: string, job: JobDescription): GeneratedCoverLetter {
    try {
      // Try to extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          subject: parsed.subject || `Application for ${job.title} at ${job.company}`,
          body: parsed.body || '',
          highlights: parsed.highlights || [],
          fitScore: parsed.fitScore || 0,
        };
      }
    } catch (e) {
      // Fall through to fallback
    }
    return this.generateFallbackCoverLetter(job, {} as any);
  }

  private parseResumeTailorResponse(
    response: string,
    original: any[]
  ): any[] {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const tailored = JSON.parse(jsonMatch[0]);
        return original.map(exp => ({
          ...exp,
          bullets: tailored[exp.company] || exp.bullets,
        }));
      }
    } catch {}
    return original;
  }

  private parseJobFitResponse(response: string): {
    score: number;
    reasoning: string;
    keyMatches: string[];
    gaps: string[];
  } {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          score: parsed.score || 0,
          reasoning: parsed.reasoning || '',
          keyMatches: parsed.keyMatches || [],
          gaps: parsed.gaps || [],
        };
      }
    } catch {}
    return { score: 50, reasoning: 'Unable to parse', keyMatches: [], gaps: [] };
  }

  private generateFallbackCoverLetter(
    job: JobDescription,
    profile: any
  ): GeneratedCoverLetter {
    const name = profile.name || 'the candidate';
    const highlights = [
      `Extensive experience in AI/LLM engineering and full-stack development`,
      `Track record of shipping production AI products (YapGPT, JudeAI, Fine Photo Gen)`,
      `Strong product management background with deep technical expertise`,
    ];

    return {
      subject: `Application for ${job.title} - ${name}`,
      body: `Dear Hiring Team,

I am writing to express my strong interest in the ${job.title} position at ${job.company}. With extensive experience building and shipping AI-powered products — including multi-LLM chat platforms, AI image generation tools, and AI assistants for enterprise — I bring a rare combination of deep technical expertise and product sense that directly aligns with this role.

${job.description ? `Your description of the role particularly resonates because I've built similar systems. ` : ''}My recent work includes shipping YapGPT (a multi-LLM chat layer supporting Claude, OpenAI, and Gemini with real-time streaming) in under six weeks, and building Fine Photo Gen (an AI image/video generation platform supporting Veo3, Flux, and custom LoRA uploads) in a single week. These projects demonstrate my ability to move fast while delivering production-quality AI systems.

Beyond pure engineering, my product management background at Keller Williams (where I led vision-to-launch for features that doubled home-search usage) and Neiman Marcus (where I drove a 20% increase in associate outreach) means I understand how to build products that users love, not just technically impressive demos. I write clean, maintainable code, obsess over user experience, and thrive in fast-paced environments where shipping velocity matters.

I would welcome the opportunity to discuss how my experience building AI products end-to-end could contribute to ${job.company}'s goals. Thank you for your consideration.

Best regards,
${name}`,
      highlights,
      fitScore: 75,
    };
  }

  private calculateBasicFitScore(
    job: JobDescription,
    profile: any
  ): { score: number; reasoning: string; keyMatches: string[]; gaps: string[] } {
    const desc = (job.description + ' ' + (job.requirements || []).join(' ')).toLowerCase();
    const skills = profile.skills.map((s: string) => s.toLowerCase());
    
    const keyMatches: string[] = [];
    const gaps: string[] = [];
    
    const aiKeywords = ['ai', 'llm', 'machine learning', 'deep learning', 'nlp', 'transformer', 'gpt', 'claude', 'openai', 'langchain', 'vector', 'embedding', 'rag', 'fine-tun', 'prompt'];
    const engKeywords = ['react', 'typescript', 'python', 'node', 'next.js', 'postgres', 'mongodb', 'docker', 'aws', 'kubernetes'];
    
    for (const kw of aiKeywords) {
      if (desc.includes(kw)) {
        if (skills.some((s: string) => s.includes(kw) || kw.includes(s))) {
          keyMatches.push(kw);
        } else {
          gaps.push(kw);
        }
      }
    }
    
    for (const kw of engKeywords) {
      if (desc.includes(kw)) {
        if (skills.some((s: string) => s.includes(kw) || kw.includes(s))) {
          keyMatches.push(kw);
        }
      }
    }
    
    const score = Math.min(95, Math.round((keyMatches.length / (keyMatches.length + gaps.length + 1)) * 85 + 10));
    
    return {
      score,
      reasoning: `Keyword match: ${keyMatches.length} matched, ${gaps.length} gaps`,
      keyMatches,
      gaps,
    };
  }
}

// Export for use in extension
export type {
  TailorConfig,
  JobDescription,
  GeneratedCoverLetter,
  TailoredResumeSection,
};
