module.exports = {

    zipfunc: function(arr, ...arrs) {

      return arr.map((val, i) => arrs.reduce((a, arr) => [...a, arr[i]], [val]));

    },

    createOrder: function() {

      console.log("creating order");

    },

    fulfillOrder: function() {

      console.log("fulfilling order");

    },

    failedPayment: function() {

      console.log("payment failed");

    }
  };
