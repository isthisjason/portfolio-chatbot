import { boundaries } from "./boundaries.js";
import { education } from "./education.js";
import { experience } from "./experience.js";
import { maintenance } from "./maintenance.js";
import { owner } from "./owner.js";
import { projects } from "./projects.js";
import { stack } from "./stack.js";

function compactStringList(values) {
  return values
    .map((value) => String(value || "").trim())
    .filter(Boolean);
}

function compactLinkList(links = []) {
  return links
    .filter((link) => link?.label && link?.url)
    .map((link) => ({
      label: String(link.label).trim(),
      url: String(link.url).trim(),
    }));
}

function parsePositiveInteger(value, fallback = 30) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

export function getPortfolioData() {
  return {
    owner: {
      name: String(owner.name || "").trim(),
      publicLabel: String(owner.publicLabel || owner.name || "").trim(),
      role: String(owner.role || "").trim(),
      location: String(owner.location || "").trim(),
      recruiterSummary: compactStringList(owner.recruiterSummary || []),
      strengths: compactStringList(owner.strengths || []),
      preferredWork: compactStringList(owner.preferredWork || []),
    },
    projects: (projects || []).map((project) => ({
      slug: String(project.slug || "").trim(),
      name: String(project.name || "").trim(),
      oneLiner: String(project.oneLiner || "").trim(),
      status: String(project.status || "").trim(),
      stack: compactStringList(project.stack || []),
      themes: compactStringList(project.themes || []),
      strengthsShown: compactStringList(project.strengthsShown || []),
      architecture: compactStringList(project.architecture || []),
      outcomes: compactStringList(project.outcomes || []),
      links: compactLinkList(project.links || []),
    })),
    experience: (experience || []).map((item) => ({
      company: String(item.company || "").trim(),
      role: String(item.role || "").trim(),
      period: String(item.period || "").trim(),
      location: String(item.location || "").trim(),
      highlights: compactStringList(item.highlights || []),
      technologies: compactStringList(item.technologies || []),
    })),
    education: (education || []).map((item) => ({
      institution: String(item.institution || "").trim(),
      location: String(item.location || "").trim(),
      degree: String(item.degree || "").trim(),
      field: String(item.field || "").trim(),
      period: String(item.period || "").trim(),
      gpa: String(item.gpa || "").trim(),
    })),
    stack: {
      languages: compactStringList(stack.languages || []),
      frontend: compactStringList(stack.frontend || []),
      backend: compactStringList(stack.backend || []),
      infrastructure: compactStringList(stack.infrastructure || []),
      databases: compactStringList(stack.databases || []),
      security: compactStringList(stack.security || []),
    },
    boundaries: {
      allowedTopics: compactStringList(boundaries.allowedTopics || []),
      restrictedTopics: compactStringList(boundaries.restrictedTopics || []),
      fallbackMessage: String(boundaries.fallbackMessage || "").trim(),
    },
    maintenance: {
      updatedAt: String(maintenance.updatedAt || "").trim(),
      sourceOfTruth: compactStringList(maintenance.sourceOfTruth || []),
      reviewCadenceDays: parsePositiveInteger(maintenance.reviewCadenceDays, 30),
    },
  };
}

export function validatePortfolioData(portfolioData) {
  const warnings = [];

  if (!portfolioData.owner.name) {
    warnings.push("owner.name is empty");
  }

  if (!portfolioData.owner.role) {
    warnings.push("owner.role is empty");
  }

  if (!portfolioData.owner.recruiterSummary.length) {
    warnings.push("owner.recruiterSummary has no entries");
  }

  if (!portfolioData.projects.length) {
    warnings.push("projects is empty");
  }

  if (!portfolioData.experience.length) {
    warnings.push("experience is empty");
  }

  if (!portfolioData.education.length) {
    warnings.push("education is empty");
  }

  if (!portfolioData.maintenance.updatedAt) {
    warnings.push("maintenance.updatedAt is empty");
  }

  if (!portfolioData.maintenance.sourceOfTruth.length) {
    warnings.push("maintenance.sourceOfTruth has no entries");
  }

  return warnings;
}
