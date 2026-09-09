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
