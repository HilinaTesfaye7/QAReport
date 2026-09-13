import usersHandler from '../api/users.js';
import { generateToken } from '../api/_utils/auth.js';

const token = generateToken({
  id: 'usr-sarah',
  username: 'sarah',
  role: 'QA Director',
  must_change_password: false
});

const mockReq = {
  method: 'GET',
  headers: {
    cookie: `auth_token=${token}`
  },
  url: '/api/users'
};

const mockRes = {
  setHeader: () => {},
  status: function(code) {
    this.statusCode = code;
    return this;
  },
  json: function(data) {
    console.log("STATUS:", this.statusCode);
    console.log("RESPONSE_LENGTH:", Array.isArray(data) ? data.length : "Not array");
    const hshs = data.find && data.find(u => u.full_name === 'Hshs bdhd');
    console.log("HSHS USER:", JSON.stringify(hshs, null, 2));
  },
  end: function() {
    console.log("STATUS:", this.statusCode);
    console.log("ENDED");
  }
};

usersHandler(mockReq, mockRes);
