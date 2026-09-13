import usersHandler from './api/users.js';

const mockReq = {
  method: 'GET',
  headers: {},
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
    console.log("RESPONSE:", JSON.stringify(data, null, 2));
  },
  end: function() {
    console.log("STATUS:", this.statusCode);
    console.log("ENDED");
  }
};

usersHandler(mockReq, mockRes);
