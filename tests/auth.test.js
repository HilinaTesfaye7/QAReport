import assert from 'assert';

// Simple mock for HTTP request and response
const createRequest = (options) => {
  const req = { headers: {}, ...options };
  return req;
};
const createResponse = () => {
  let statusCode = 200;
  let headers = {};
  let body = '';
  return {
    status: function (code) { statusCode = code; return this; },
    setHeader: function (key, value) { headers[key] = value; },
    json: function (data) { body = JSON.stringify(data); return this; },
    end: function () { return this; },
    _getData: () => body,
    getHeader: function (key) { return headers[key]; },
    get statusCode() { return statusCode; }
  };
};

// We import the handlers
import loginHandler from '../api/auth/login.js';
import changePasswordHandler from '../api/auth/change-password.js';
import forgotPasswordHandler from '../api/auth/forgot-password.js';
import resetPasswordHandler from '../api/auth/reset-password.js';
import projectsHandler from '../api/projects.js';
import tasksHandler from '../api/tasks.js';
import usersHandler from '../api/users.js';

async function runTests() {
  console.log('--- STARTING AUTHENTICATION & AUTHORIZATION TESTS ---');

  // 1. Test Login with valid credentials
  console.log('Test 1: Login with valid credentials');
  let req = createRequest({ method: 'POST', body: { username: 'hana.qa', password: 'Valid123!' } });
  let res = createResponse();
  await loginHandler(req, res);
  assert.strictEqual(res.statusCode, 200);
  const data = JSON.parse(res._getData());
  assert.ok(data.id);
  
  const cookieHeader = res.getHeader('Set-Cookie');
  assert.ok(cookieHeader);
  const tokenMatch = cookieHeader.match(/auth_token=([^;]+)/);
  assert.ok(tokenMatch);
  const testerToken = tokenMatch[1];
  console.log('✅ Passed Test 1');

  // 2. Test Login with invalid credentials
  console.log('Test 2: Login with invalid credentials');
  req = createRequest({ method: 'POST', body: { username: 'hana.qa', password: 'wrongpassword' } });
  res = createResponse();
  await loginHandler(req, res);
  assert.strictEqual(res.statusCode, 401);
  console.log('✅ Passed Test 2');

  // 3. Test Unauthorized access to /api/tasks (No token)
  console.log('Test 3: Unauthenticated access blocked');
  req = createRequest({ method: 'GET', url: '/api/tasks' });
  res = createResponse();
  await tasksHandler(req, res);
  assert.strictEqual(res.statusCode, 401);
  console.log('✅ Passed Test 3');

  // 4. Test QA Tester tasks endpoint (Should only see assigned tasks)
  console.log('Test 4: QA Tester task access (RBAC)');
  req = createRequest({
    method: 'GET',
    url: '/api/tasks',
    headers: { authorization: `Bearer ${testerToken}`, cookie: `auth_token=${testerToken}` }
  });
  res = createResponse();
  await tasksHandler(req, res);
  assert.strictEqual(res.statusCode, 200);
  const testerTasks = JSON.parse(res._getData());
  // hana_qa (usr-hana) is assigned to some tasks
  testerTasks.forEach(t => assert.strictEqual(t.assigneeId, 'usr-hana'));
  console.log('✅ Passed Test 4');

  // 5. Test QA Lead tasks endpoint (Should see all tasks in their projects)
  console.log('Test 5: QA Lead task access (RBAC)');
  // Get QA Lead token
  req = createRequest({ method: 'POST', body: { username: 'sarah.qa', password: 'Temp123!' } });
  res = createResponse();
  await loginHandler(req, res);
  assert.strictEqual(res.statusCode, 200);
  
  const leadCookieHeader = res.getHeader('Set-Cookie');
  const leadTokenMatch = leadCookieHeader.match(/auth_token=([^;]+)/);
  const leadToken = leadTokenMatch[1];

  req = createRequest({
    method: 'GET',
    url: '/api/tasks',
    headers: { authorization: `Bearer ${leadToken}`, cookie: `auth_token=${leadToken}` }
  });
  res = createResponse();
  await tasksHandler(req, res);
  assert.strictEqual(res.statusCode, 200);
  const leadTasks = JSON.parse(res._getData());
  // Lead should see more tasks
  assert.ok(leadTasks.length > 0);
  console.log('✅ Passed Test 5');

  // 6. Test Change Password Complexity
  console.log('Test 6: Change password complexity requirements');
  req = createRequest({
    method: 'POST',
    url: '/api/auth/change-password',
    headers: { authorization: `Bearer ${testerToken}`, cookie: `auth_token=${testerToken}` },
    body: { oldPassword: 'Valid123!', newPassword: 'weak' }
  });
  res = createResponse();
  await changePasswordHandler(req, res);
  assert.strictEqual(res.statusCode, 400); // Bad Request due to complexity
  console.log('✅ Passed Test 6');

  // 7. Test Forgot Password does not enumerate users
  console.log('Test 7: Forgot password prevents enumeration');
  req = createRequest({ method: 'POST', body: { username: 'nonexistent_user' } });
  res = createResponse();
  await forgotPasswordHandler(req, res);
  assert.strictEqual(res.statusCode, 200);
  assert.ok(JSON.parse(res._getData()).message.includes('If the account exists'));
  console.log('✅ Passed Test 7');

  // 8. Test users API sensitive data stripping
  console.log('Test 8: Users API does not expose password hashes');
  req = createRequest({
    method: 'GET',
    url: '/api/users',
    headers: { authorization: `Bearer ${leadToken}`, cookie: `auth_token=${leadToken}` }
  });
  res = createResponse();
  await usersHandler(req, res);
  assert.strictEqual(res.statusCode, 200);
  const users = JSON.parse(res._getData());
  users.forEach(u => {
    assert.strictEqual(u.password_hash, undefined);
    assert.strictEqual(u.passwordHash, undefined);
  });
  console.log('✅ Passed Test 8');

  console.log('--- ALL TESTS PASSED SUCCESSFULLY ---');
}

runTests().catch(err => {
  console.error('Test Failed!', err);
  process.exit(1);
});
