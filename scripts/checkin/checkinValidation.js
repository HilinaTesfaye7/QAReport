export function validateTestExecution(executed, passed, failed, blocked) {
  return (passed + failed + blocked) <= executed;
}

export function calculateExecutionStats(executed, passed, failed, blocked) {
  if (executed === 0) return { passRate: 0, failRate: 0, blockRate: 0 };
  return {
    passRate: Number(((passed / executed) * 100).toFixed(1)),
    failRate: Number(((failed / executed) * 100).toFixed(1)),
    blockRate: Number(((blocked / executed) * 100).toFixed(1))
  };
}

export function parseMetricsString(text) {
  const parts = text.split(/[\/,]+/).map(p => p.trim());
  if (parts.length < 4) return null;
  const metrics = parts.slice(0, 4).map(p => parseInt(p, 10));
  if (metrics.some(isNaN)) return null;
  return {
    executed: metrics[0],
    passed: metrics[1],
    failed: metrics[2],
    blocked: metrics[3]
  };
}
