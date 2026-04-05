import { getPortfolioData, validatePortfolioData } from "../data/portfolio/index.js";

const DAY_MS = 24 * 60 * 60 * 1000;

function daysBetween(fromIsoDate, toTimestamp = Date.now()) {
  const parsed = Date.parse(fromIsoDate);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return Math.floor((toTimestamp - parsed) / DAY_MS);
}

function checkProjectQuality(projects) {
  const warnings = [];

  for (const project of projects) {
    if (!project.name) {
      warnings.push("A project is missing name.");
    }
    if (!project.oneLiner) {
      warnings.push(`Project '${project.slug || "unknown"}' is missing oneLiner.`);
    }
    if (!project.stack.length) {
      warnings.push(`Project '${project.name || project.slug}' has no stack entries.`);
    }
    if (!project.outcomes.length) {
      warnings.push(`Project '${project.name || project.slug}' has no outcomes.`);
    }
    if (!project.links.length) {
      warnings.push(`Project '${project.name || project.slug}' has no public links.`);
    }
  }

  return warnings;
}

function checkFreshness(maintenance) {
  const warnings = [];
  const updatedAt = maintenance.updatedAt;
  const cadenceDays = maintenance.reviewCadenceDays || 30;
  const elapsedDays = daysBetween(updatedAt);

  if (elapsedDays === null) {
    warnings.push(
      "maintenance.updatedAt is not a valid ISO date (expected YYYY-MM-DD).",
    );
    return warnings;
  }

  if (elapsedDays > cadenceDays) {
    warnings.push(
      `Portfolio context review is overdue by ${elapsedDays - cadenceDays} day(s) (updated ${elapsedDays} day(s) ago).`,
    );
  }

  return warnings;
}

function main() {
  const portfolioData = getPortfolioData();
  const warnings = [
    ...validatePortfolioData(portfolioData),
    ...checkProjectQuality(portfolioData.projects),
    ...checkFreshness(portfolioData.maintenance),
  ];

  console.log("Portfolio context maintenance check");
  console.log(`- owner: ${portfolioData.owner.name || "missing"}`);
  console.log(`- projects: ${portfolioData.projects.length}`);
  console.log(`- experience entries: ${portfolioData.experience.length}`);
  console.log(`- updatedAt: ${portfolioData.maintenance.updatedAt || "missing"}`);
  console.log(`- review cadence: every ${portfolioData.maintenance.reviewCadenceDays} day(s)`);

  if (!warnings.length) {
    console.log("PASS context data looks healthy and current.");
    return;
  }

  console.log("WARN context maintenance issues found:");
  for (const warning of warnings) {
    console.log(`- ${warning}`);
  }
  process.exitCode = 1;
}

main();
