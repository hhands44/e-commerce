// secrets file
require('dotenv').config();

const stripeWebhookKey = process.env.STRIPE_WEBHOOK_KEY;
const stripeAPIKey = process.env.STRIPE_API_KEY;
const genkaiKey = process.env.GENKAI_KEY;


// imports
const express = require('express');
const Papa = require('papaparse');
const fs = require('fs-extra');
const bodyParser = require('body-parser');
const ejs = require('ejs');
const mongoose = require('mongoose');
const Stripe = require('stripe');
const stripe = Stripe(stripeAPIKey);

const helpers = require('./helpers');


// creating sessions:
const session = require('express-session');
const MongoDBStore = require('connect-mongodb-session')(session);

const app = express();


app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({
  extended: true
}));

app.use(express.static("public"));

const store = new MongoDBStore({
  uri: 'mongodb+srv://admin-h:admin@genkai.nq8py.mongodb.net/genkaiDB',
  collection: 'cookiesessions'
});

// Catch errors
store.on('error', function(error) {
  console.log(error);
});

// express-session and passport set up must be at this palce in flow of your code

app.use(session({
  secret: genkaiKey,
  resave: false,
  saveUninitialized: false,
  store: store
}));


// connect to cloud mongodb server and check if connection working
mongoose.connect('mongodb+srv://admin-h:admin@genkai.nq8py.mongodb.net/genkaiDB', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

const db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function() {
  console.log('connected to cloud dbs');
});





// create shopping basket schema
const shoppingBasketSchema = new mongoose.Schema({
  sBagId: {
    type: String,
    required: true
  },
  products: {
    type: [],
    required: true
  },
  sizes: {
    type: [],
    required: true
  },
  qtys: {
    type: [],
    required: true
  },
  prices: {
    type: [],
    required: false
  }
},
{
  timestamps: true
});

const shoppingBasket = mongoose.model('shoppingBasket', shoppingBasketSchema);


// create product schema (doing this just to connect to the basket atm)
const productListSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  type: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    required: true
  },
  salePrice: {
    type: Number,
    required: true
  },
  twoFifteen: {
    type: Object,
    required: true
  },
  descriptions: {
    type: [],
    required: true
  },
  soldOut: {
    type: Boolean,
    required: true
  }
});

const productList = mongoose.model('productList', productListSchema);

// create waitinglist schema

const waitingListSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true
  },
  product: {
    type: String,
    required: false
  }
},
{
  timestamps: true
});

const waitingList = mongoose.model('waitinglist', waitingListSchema);



const orderSchema = new mongoose.Schema({
  orderDetails: {
    type: [],
    required: true
  },
  deliveryDetails: {
    type: Object,
    required: true
  },
  customerEmail: {
    type: String,
    required: true
  },
  basketTotal: {
    type: Number,
    required: true
  },
  stripeTotal: {
    type: Number,
    required: true
  },
  fulfilled: {
    type: Boolean
  }

},
{
  timestamps: true
});

const deliveryList = mongoose.model('deliveryList', orderSchema);
const orderList = mongoose.model('orderList', orderSchema)









// render pages

app.get('/', (req, res) => {


  res.render('home');

});

app.get('/about', (req, res) => {

  res.render('about');

});

app.get('/store', (req, res) => {

  productList.find({}, (err, products) => {
    res.render('store', {
      products: products,
      display: 'flex'
    });
  });


});

app.get('/success', (req, res) => {


  shoppingBasket.deleteOne({
    sBagId: req.session.genkaicartid
  }, (err) => {

  });

  res.render('response', {
    responseMessage: 'Thanks for your order, your clothes will be with you shortly!',
    display: 'none'
  });

});

app.get('/cancel', (req, res) => {

  res.render('cancel');

});


app.get('/cart', (req, res) => {


  shoppingBasket.exists({
    sBagId: req.session.genkaicartid
  }, (err, cart) => {

    if (!cart) {
      // display no items

      res.render('response', {
        responseMessage: 'Add something to your cart first.',
        display: 'none'
      });

    } else {

      // display shopping basket:
      shoppingBasket.find({
        sBagId: req.session.genkaicartid
      }, (err, basket) => {

        const priceArray = basket[0].prices;
        const totalPrice = priceArray.reduce((a, b) => a + b, 0);


        res.render('cart', {
          basket: basket,
          totalPrice: totalPrice
        });

      });

    }

  });


});

app.get('/privacy-policy', (req, res) => {
  res.render('privacy-policy');
})



app.get('/:productname', (req, res) => {

  const productName = req.params.productname;

  productList.exists({
    name: productName
  }, (err, exists) => {

    if (exists === true) {
      productList.find({
        name: productName
      }, (err, product) => {

        const productPrice = product[0].price;
        const productSalePrice = product[0].salePrice;
        const productDescriptions = product[0].descriptions;
        const productType = product[0].type;
        const soldOut = product[0].soldOut;


        res.render('productpage', {
          displayType: 'none',
          alertColor: 'white',
          cartMessage: '',
          productName: productName,
          productPrice: productPrice,
          productSalePrice: productSalePrice,
          productDescriptions: productDescriptions,
          productType: productType,
          soldOut: soldOut
        });

      });
    } else {
      res.render('response', {
        responseMessage: 'Go back to the homepage, this page does not exist.',
        display: 'none'
      })
    }

  });

});









// adding items to shopping basket

app.post('/add', (req, res) => {
  const prodSize = req.body.size;
  const prodName = req.body.name;
  let prodQty = Math.abs(req.body.qty);

  // make sure people can't select 0 items
  if (req.body.qty == 0) {
    prodQty += 1;
  }

  // create a new nekai session id if not already assigned
  if (typeof req.session.genkaicartid === 'undefined') {
    // create Object Id for this users shopping bag to use as known identifier in genkaicartid cookie
    const objectId = mongoose.Types.ObjectId;
    const hexId = new objectId;
    req.session.genkaicartid = hexId.toString();
  }



  if (typeof prodSize === 'undefined') {

    productList.find({
      name: prodName
    }, (err, product) => {


      res.render('productpage', {
        displayType: 'flex',
        alertColor: 'rgba(253, 131, 181, 0.75)',
        cartMessage: 'select a size',
        productName: prodName,
        productPrice: product[0].price,
        productSalePrice: product[0].salePrice,
        productDescriptions: product[0].descriptions,
        productType: product[0].type,
        soldOut: product[0].soldOut
      });
    });

  } else {

    shoppingBasket.exists({
      sBagId: req.session.genkaicartid
    }, (err, cart) => {

      if (!cart) {
        // create new shopping basket

        productList.find({
          name: prodName
        }, (err, product) => {

          if (product[0].salePrice !== undefined) {

            const sumPrice = product[0].salePrice * prodQty;
            const basket = new shoppingBasket({
              sBagId: req.session.genkaicartid,
              products: [prodName],
              sizes: [prodSize],
              qtys: [prodQty],
              prices: [sumPrice]
            });
            basket.save();

          } else {

            const sumPrice = product[0].price * prodQty;
            const basket = new shoppingBasket({
              sBagId: req.session.genkaicartid,
              products: [prodName],
              sizes: [prodSize],
              qtys: [prodQty],
              prices: [sumPrice]
            });
            basket.save();

          }

        });


      } else {
        // add to existing shopping basket

        productList.find({
          name: prodName
        }, (err, product) => {


          if (product[0].salePrice !== undefined) {

            const sumPrice = product[0].salePrice * prodQty;
            shoppingBasket.updateOne({
                sBagId: req.session.genkaicartid
              }, {
                $push: {
                  products: prodName,
                  sizes: prodSize,
                  qtys: prodQty,
                  prices: sumPrice
                }
              },
              function(err) {
                if (!err) {}
              });

          } else {

            const sumPrice = product[0].price * prodQty;
            shoppingBasket.updateOne({
                sBagId: req.session.genkaicartid
              }, {
                $push: {
                  products: prodName,
                  sizes: prodSize,
                  qtys: prodQty,
                  prices: sumPrice
                }
              },
              function(err) {
                if (!err) {}
              });
          }



        });


      }

    });

    productList.find({
      name: prodName
    }, (err, product) => {

      res.render('productpage', {
        displayType: 'flex',
        alertColor: 'rgba(133, 252, 193, 0.75)',
        cartMessage: 'Item added',
        productName: prodName,
        productPrice: product[0].price,
        productSalePrice: product[0].salePrice,
        productDescriptions: product[0].descriptions,
        productType: product[0].type,
        soldOut: product[0].soldOut
      });
    });
  }

});



// send them straight to stripe
app.post('/buynow', (req, res) => {
  const prodSize = req.body.size;
  const prodName = req.body.name;
  let prodQty = Math.abs(req.body.qty);
  // make sure people can't select 0 items
  if (req.body.qty == 0) {
    prodQty += 1;
  }
  // create a new nekai session id if not already assigned
  if (typeof req.session.genkaicartid === 'undefined') {
    // create Object Id for this users shopping bag to use as known identifier in genkaicartid cookie
    const objectId = mongoose.Types.ObjectId;
    const hexId = new objectId;
    req.session.genkaicartid = hexId.toString();
  }
  if (typeof prodSize === 'undefined') {
    productList.find({
      name: prodName
    }, (err, product) => {
      res.render('productpage', {
        displayType: 'flex',
        alertColor: 'rgba(253, 131, 181, 0.75)',
        cartMessage: 'select a size',
        productName: prodName,
        productPrice: product[0].price,
        productSalePrice: product[0].salePrice,
        productDescriptions: product[0].descriptions,
        productType: product[0].type,
        soldOut: product[0].soldOut
      });
    });
  } else {
    shoppingBasket.exists({
      sBagId: req.session.genkaicartid
    }, (err, cart) => {
      if (!cart) {
        // create new shopping basket
        productList.find({
          name: prodName
        }, (err, product) => {

          if (product[0].salePrice !== undefined) {
            const sumPrice = product[0].salePrice * prodQty;
            const basket = new shoppingBasket({
              sBagId: req.session.genkaicartid,
              products: [prodName],
              sizes: [prodSize],
              qtys: [prodQty],
              prices: [sumPrice]
            });
            basket.save();
          } else {
              const sumPrice = product[0].price * prodQty;
              const basket = new shoppingBasket({
                sBagId: req.session.genkaicartid,
                products: [prodName],
                sizes: [prodSize],
                qtys: [prodQty],
                prices: [sumPrice]
              });
              basket.save();
          }
        });
      } else {
        // add to existing shopping basket
        productList.find({
          name: prodName
        }, (err, product) => {
          if (product[0].salePrice !== undefined) {
            const sumPrice = product[0].salePrice * prodQty;
            shoppingBasket.updateOne({
                sBagId: req.session.genkaicartid
              }, {
                $push: {
                  products: prodName,
                  sizes: prodSize,
                  qtys: prodQty,
                  prices: sumPrice
                }
              },
              function(err) {
                if (!err) {}
              });
          } else {
              const sumPrice = product[0].price * prodQty;
              shoppingBasket.updateOne({
                  sBagId: req.session.genkaicartid
                }, {
                  $push: {
                    products: prodName,
                    sizes: prodSize,
                    qtys: prodQty,
                    prices: sumPrice
                  }
                },
                function(err) {
                  if (!err) {}
                });
          }
        });
      }
    });

    res.redirect('/cart');
  }

});



// deleting items from shopping basket
app.post('/delete', (req, res) => {

  const deletedIndex = req.body.checkbox;
  const prodIndex = 'products.' + deletedIndex
  const sizeIndex = 'sizes.' + deletedIndex
  const qtyIndex = 'qtys.' + deletedIndex
  const pricesIndex = 'prices.' + deletedIndex


  const unsetQuery = {};
  unsetQuery[prodIndex] = 1;
  unsetQuery[sizeIndex] = 1;
  unsetQuery[qtyIndex] = 1;
  unsetQuery[pricesIndex] = 1;


  shoppingBasket.updateOne({
    sBagId: req.session.genkaicartid
  }, {
    $unset: unsetQuery
  }, (err) => {
    if (!err) {}
  });

  pullQuery = {
    products: null,
    sizes: null,
    qtys: null,
    prices: null
  };

  shoppingBasket.updateOne({
    sBagId: req.session.genkaicartid
  }, {
    $pull: pullQuery
  }, (err) => {
    if (!err) {
      res.redirect('/cart');
    }
  });

});





// add people to waiting list
app.post('/join', (req, res) => {

  const subscriberEmail = req.body.email;


  waitingList.exists({
    email: subscriberEmail
  }, (err, subscriber) => {

    if (!subscriber) {

      // create new waitingList customer
      const subscriber = new waitingList({
        email: subscriberEmail
      });

      subscriber.save((err) => {
        if (!err) {
          // res.redirect('/success');
          res.render('response', {
            responseMessage: "Thanks for joing, we'll send you and email the next time we have any offers or new releases. \n \n STAY TUNED.",
            display: 'none'
          });
        } else {
          // res.redirect('/failure');Something went wrong, please try again!
          res.render('response', {
            responseMessage: "Something went wrong, please try again",
            display: 'none'
          });
        }
      });

    } else {

      res.render('response', {
        responseMessage: "We've got you already, watch your inbox",
        display: 'none'
      });

    }

  });


});



// create stripe checkout post from cart page
app.post('/create-checkout-session', async (req, res) => {


  shoppingBasket.find({
    sBagId: req.session.genkaicartid
  }, async (err, baskets) => {

    const basket = baskets[0];
    const priceArray = basket.prices;
    const totalPrice = priceArray.reduce((a, b) => a + b, 0);
    const stripePrice = totalPrice * 100;
    const finalPrice = stripePrice.toString();

    // let basketContents = helpers.zipfunc(basket.products, basket.sizes, basket.qtys, basket.prices);
    // console.log(basketContents.length);
    //
    // let order = {};
    // for (i=0; i<basketContents.length; i++) {
    //
    //   let basket = basketContents[i];
    //
    //   order[i] = {
    //     product: basket[0],
    //     size: basket[1],
    //     qty: basket[2],
    //     price: basket[3]
    //   }
    //
    // }
    // console.log(order);




    const session = await stripe.checkout.sessions.create({
      shipping_address_collection: {
        allowed_countries: ['AC', 'AD', 'AE', 'AF', 'AG', 'AI', 'AL', 'AM', 'AO', 'AQ', 'AR', 'AT', 'AU', 'AW', 'AX', 'AZ', 'BA', 'BB', 'BD', 'BE', 'BF', 'BG', 'BH', 'BI', 'BJ', 'BL', 'BM', 'BN', 'BO', 'BQ', 'BR', 'BS', 'BT', 'BV', 'BW', 'BY', 'BZ', 'CA', 'CD', 'CF', 'CG', 'CH', 'CI', 'CK', 'CL', 'CM', 'CN', 'CO', 'CR', 'CV', 'CW', 'CY', 'CZ', 'DE', 'DJ', 'DK', 'DM', 'DO', 'DZ', 'EC', 'EE', 'EG', 'EH', 'ER', 'ES', 'ET', 'FI', 'FJ', 'FK', 'FO', 'FR', 'GA', 'GB', 'GD', 'GE', 'GF', 'GG', 'GH', 'GI', 'GL', 'GM', 'GN', 'GP', 'GQ', 'GR', 'GS', 'GT', 'GU', 'GW', 'GY', 'HK', 'HN', 'HR', 'HT', 'HU', 'ID', 'IE', 'IL', 'IM', 'IN', 'IO', 'IQ', 'IS', 'IT', 'JE', 'JM', 'JO', 'JP', 'KE', 'KG', 'KH', 'KI', 'KM', 'KN', 'KR', 'KW', 'KY', 'KZ', 'LA', 'LB', 'LC', 'LI', 'LK', 'LR', 'LS', 'LT', 'LU', 'LV', 'LY', 'MA', 'MC', 'MD', 'ME', 'MF', 'MG', 'MK', 'ML', 'MM', 'MN', 'MO', 'MQ', 'MR', 'MS', 'MT', 'MU', 'MV', 'MW', 'MX', 'MY', 'MZ', 'NA', 'NC', 'NE', 'NG', 'NI', 'NL', 'NO', 'NP', 'NR', 'NU', 'NZ', 'OM', 'PA', 'PE', 'PF', 'PG', 'PH', 'PK', 'PL', 'PM', 'PN', 'PR', 'PS', 'PT', 'PY', 'QA', 'RE', 'RO', 'RS', 'RU', 'RW', 'SA', 'SB', 'SC', 'SE', 'SG', 'SH', 'SI', 'SJ', 'SK', 'SL', 'SM', 'SN', 'SO', 'SR', 'SS', 'ST', 'SV', 'SX', 'SZ', 'TA', 'TC', 'TD', 'TF', 'TG', 'TH', 'TJ', 'TK', 'TL', 'TM', 'TN', 'TO', 'TR', 'TT', 'TV', 'TW', 'TZ', 'UA', 'UG', 'US', 'UY', 'UZ', 'VA', 'VC', 'VE', 'VG', 'VN', 'VU', 'WF', 'WS', 'XK', 'YE', 'YT', 'ZA', 'ZM', 'ZW', 'ZZ']
      },
      client_reference_id: req.session.genkaicartid,
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'gbp',
          product_data: {
            name: 'Your Order',
            images: ['https://www.genkai.co.uk/images/genkai-art.png'],
          },
          unit_amount: finalPrice,
        },
        quantity: 1,
      }, ],
      mode: 'payment',
      success_url: `https://www.genkai.co.uk/success`,
      cancel_url: `https://www.genkai.co.uk/cart`,
    });

    // console.log(session.id);

    res.json({
      id: session.id
    });

  });


});




app.post('/filter', (req, res) => {

  const selection = req.body.selection;
  // const rowItems = req.body.rowItemSelector

  if (selection === 'T - Shirts') {

    productList.find({
      type: 't-shirt'
    }, (err, products) => {
        res.render('store', {
        products: products,
        display: 'flex'
      });
    });
  } else if (selection === 'Hoodies') {
    productList.find({
      type: 'hoodie'
    }, (err, products) => {
      if (products.length < 1) {

        const responseMessage = selection + " are coming, stay tuned."
        res.render('response', {
          responseMessage: responseMessage,
          display: 'flex'
        });
      } else {
        res.render('store', {
          products: products,
          display: 'flex'
        });
      }
    });
  } else {
    // productList.find({}, (err, products) => {
    //   res.render('store', {products: products});
    // });
    res.redirect('store');
  }

});









app.post('/api/webhook', bodyParser.raw({
  type: 'application/json'
}), (req, res) => {

  const sig = req.headers['stripe-signature'];

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, stripeWebhookKey);
  } catch (err) {
    res.status(400).send(`Webhook Error: ${err.message}`);
  }

  switch (event.type) {
    case 'checkout.session.completed': {

      const checkout = event.data.object;


      shoppingBasket.find({
        sBagId: checkout.client_reference_id
      }, (err, basket) => {

        let details = basket[0];
        let basketTotal = details.prices.reduce((a, b) => a + b, 0);
        let orderDetails = helpers.zipfunc(details.products, details.sizes, details.qtys, details.prices);
        let stripeTotal = checkout.amount_total / 100;
        let deliveryDetails = checkout.shipping;
        let customerEmail = checkout.customer_details.email;

        const order = new orderList({
          orderDetails: orderDetails,
          deliveryDetails: deliveryDetails,
          basketTotal: basketTotal,
          stripeTotal: stripeTotal,
          customerEmail: customerEmail,
          fulfilled: false
        });
        order.save();
      });

      if (checkout.payment_status === 'paid') {
        // fulfillOrder();
        shoppingBasket.find({
          sBagId: checkout.client_reference_id
        }, (err, basket) => {

          let details = basket[0];
          let basketTotal = details.prices.reduce((a, b) => a + b, 0);
          let orderDetails = helpers.zipfunc(details.products, details.sizes, details.qtys, details.prices);
          let stripeTotal = checkout.amount_total / 100;
          let deliveryDetails = checkout.shipping;
          let customerEmail = checkout.customer_details.email;

          const delivery = new deliveryList({
            orderDetails: orderDetails,
            deliveryDetails: deliveryDetails,
            basketTotal: basketTotal,
            stripeTotal: stripeTotal,
            customerEmail: customerEmail,
            fulfilled: false
          });
          delivery.save();

        });
      }

      break;

    }
    case 'checkout.session.async_payment_succeeded': {

      const checkout = event.data.object;

      shoppingBasket.find({
        sBagId: checkout.client_reference_id
      }, (err, basket) => {

        let details = basket[0];
        let basketTotal = details.prices.reduce((a, b) => a + b, 0);
        let orderDetails = helpers.zipfunc(details.products, details.sizes, details.qtys, details.prices);
        let stripeTotal = checkout.amount_total / 100;
        let deliveryDetails = checkout.shipping;
        let customerEmail = checkout.customer_details.email;

        const delivery = new deliveryList({
          orderDetails: orderDetails,
          deliveryDetails: deliveryDetails,
          basketTotal: basketTotal,
          stripeTotal: stripeTotal,
          customerEmail: customerEmail,
          fulfilled: false

        });
        delivery.save();

      });


      break;

    }
    case 'checkout.session.async_payment_failed': {

      const checkout = event.data.object;

      // Send an email to the customer asking them to retry their order
      helpers.failedPayment();

      break;
    }

  }

  // Return a 200 response to acknowledge receipt of the event
  res.json({
    received: true
  });
});





// create order csv

// create order csv

// search for the above tag in ../genkai relase.1/app.js file and copy and paste the below code
// in it afer you have updated the version number (see below).

// Then search in this folder for the csv file called 'ordersN.csv' where N is the version number
// --> that is our orders to fulfil.




deliveryList.find({fulfilled: false}, (err, orders) => {


  console.log('--------------------------------------');
  console.log('');
  console.log('GENERATING ORDER CSV...');
  console.log('');
  console.log('--------------------------------------');


  let ordersArray = [];
  let i = 1;


  orders.forEach((order) => {

    ordersArray[i] = {};

    // console.log(order.deliveryDetails);

    let splitName = order.deliveryDetails.name.split(" ");


    // create delivery details row

    ordersArray[i]["Column 1"] = 'Regular';
    ordersArray[i]["Column 2"] = 'GENKAI';

    if (splitName.length > 1) {
      ordersArray[i]["Column 3"] = splitName[0];
      ordersArray[i]["Column 4"] = splitName.slice(1);

    } else {
      ordersArray[i]["Column 3"] = splitName[0];
      ordersArray[i]["Column 4"] = 'BLANK';
    }

    if (order.deliveryDetails.address.city === '') {

      ordersArray[i]["Column 5"] = "";
      ordersArray[i]["Column 6"] = order.deliveryDetails.address.line1;
      ordersArray[i]["Column 7"] = order.deliveryDetails.address.line2;
      ordersArray[i]["Column 8"] = order.deliveryDetails.address.state;
      ordersArray[i]["Column 9"] = order.deliveryDetails.address.state;
      ordersArray[i]["Column 10"] = order.deliveryDetails.address.country;

    }
    else {
      ordersArray[i]["Column 5"] = "";
      ordersArray[i]["Column 6"] = order.deliveryDetails.address.line1;
      ordersArray[i]["Column 7"] = order.deliveryDetails.address.line2;
      ordersArray[i]["Column 8"] = order.deliveryDetails.address.city;
      ordersArray[i]["Column 9"] = order.deliveryDetails.address.state;
      ordersArray[i]["Column 10"] = order.deliveryDetails.address.country;
    }

    if (order.deliveryDetails.address.postal_code === '') {
      ordersArray[i]["Column 11"] = "00000";
      ordersArray[i]["Column 12"] = "";

    }
    else {
      ordersArray[i]["Column 11"] = order.deliveryDetails.address.postal_code;
      ordersArray[i]["Column 12"] = "";
    }






    // create order details row

    order.orderDetails.forEach((productsOrdered) => {

      i++;
      ordersArray[i] = {};

      let twoFifteenName = {};

      if (productsOrdered[0] !== null) {

        let str = productsOrdered[0];
        let prodName = str.replace(" ", "_");

        if (productMapping[prodName].product_code === 'EP01') {

          if (productsOrdered[1] === 'XXL') {
            twoFifteenName.part_number = productMapping[prodName].product_code +'-'+productMapping[prodName].colour+'-2XL'
          }
          else {
            twoFifteenName.part_number = productMapping[prodName].product_code +'-'+productMapping[prodName].colour+'-'+productsOrdered[1];
          }
              ordersArray[i]["Column 1"] = '';
              ordersArray[i]["Column 2"] = twoFifteenName.part_number;
              ordersArray[i]["Column 3"] = productsOrdered[2];
              ordersArray[i]["Column 4"] = ""
              ordersArray[i]["Column 5"] = "39A97E41-ADB1-415C-8426-DBB17CC8EB65";
              ordersArray[i]["Column 6"] = "";
              ordersArray[i]["Column 7"] = productMapping[prodName].design_pos_front;
              ordersArray[i]["Column 8"] = productMapping[prodName].design_url_front;
              ordersArray[i]["Column 9"] = productMapping[prodName].design_pos_back;
              ordersArray[i]["Column 10"] = productMapping[prodName].design_url_back;
              ordersArray[i]["Column 11"] = "";
              ordersArray[i]["Column 12"] = "";

        }
        else {

          if (productsOrdered[1] === 'XXL') {
            twoFifteenName.part_number = productMapping[prodName].product_code + '-2XL-' + productMapping[prodName].colour;
          }
          else {
            twoFifteenName.part_number = productMapping[prodName].product_code + '-' + productsOrdered[1] + '-'+  productMapping[prodName].colour;
          }


          ordersArray[i]["Column 1"] = '';
                ordersArray[i]["Column 2"] = twoFifteenName.part_number;
                ordersArray[i]["Column 3"] = productsOrdered[2];
                ordersArray[i]["Column 4"] = ""
                ordersArray[i]["Column 5"] = "";
                ordersArray[i]["Column 6"] = "";
                ordersArray[i]["Column 7"] = productMapping[prodName].design_pos_front;
                ordersArray[i]["Column 8"] = productMapping[prodName].design_url_front;
                ordersArray[i]["Column 9"] = productMapping[prodName].design_pos_back;
                ordersArray[i]["Column 10"] = productMapping[prodName].design_url_back;
                ordersArray[i]["Column 11"] = "";
                ordersArray[i]["Column 12"] = "";
        }

        }

  //     if (productsOrdered[0] !== null) {
  //
  //       ordersArray[i]["Column 1"] = '';
  //       ordersArray[i]["Column 2"] = twoFifteenName.part_number;
  //       ordersArray[i]["Column 3"] = productsOrdered[2];
  //       ordersArray[i]["Column 4"] = ""
  //       ordersArray[i]["Column 5"] = "";
  //       ordersArray[i]["Column 6"] = "";
  //       ordersArray[i]["Column 7"] = productMapping[prodName].design_pos_front;
  //       ordersArray[i]["Column 8"] = productMapping[prodName].design_url_front;
  //       ordersArray[i]["Column 9"] = productMapping[prodName].design_pos_back;
  //       ordersArray[i]["Column 10"] = productMapping[prodName].design_url_back;
  //       ordersArray[i]["Column 11"] = "";
  //       ordersArray[i]["Column 12"] = "";
  //
  //
  // }
      // get two-fifteen details

      // let descriptors = {};

      // productList.find({name: productsOrdered[0]}, (err, productCodes) =>  {
      //
      //    console.log('in here');
      //
      //   i++;
      //   ordersArray[i] = {};
      //   // descriptors.productCode = productCodes[0].twoFifteen.productCode;
      //   // descriptors.colour = productCodes[0].twoFifteen.colour;
      //   //
      //   // ordersArray[i]["Column 1"] = '';
      //   // ordersArray[i]["Column 2"] = 'Part Number'
      //   // ordersArray[i]["Column 3"] = productsOrdered[2];
      //   // ordersArray[i]["Column 4"] = "Description"
      //   // ordersArray[i]["Column 5"] = "Printed Label Name";
      //   // ordersArray[i]["Column 6"] = "Sewn Label Name";
      //   // ordersArray[i]["Column 7"] = "Design Position";
      //   // ordersArray[i]["Column 8"] = "Design URL";
      //   // ordersArray[i]["Column 9"] = "Design Position";
      //   // ordersArray[i]["Column 10"] = "Design URL";
      //   // ordersArray[i]["Column 11"] = "Design Position";
      //   // ordersArray[i]["Column 12"] = "Design URL";
      //
      //   // console.log(descriptors);
      //
      // });

      // console.log(descriptors);



    });




    // change the fulfilled flag for these orders
    deliveryList.updateOne({
        _id: order._id
      }, {
        fulfilled: true
      },
      (err) => {
        if (!err) {}
      });


    i++;

  });


  let filteredArray = ordersArray.filter(function(element) {
    return element !== undefined;
  });

  let csv = Papa.unparse(filteredArray, {header:false});
  console.log(csv);

  let fileName = version + ".csv";
  let fileLoc = '/Users/hhands/Documents/Projects/genkai/orders/orders/' + fileName;
  fs.writeFile(fileLoc, csv, function(err) {
    if (err) return console.log(err);
    console.log('--------------------------------------');
    console.log('');
    console.log('CHECKLIST:');
    console.log('');
    console.log('--------------------------------------');
    console.log('--------------------------------------');
    console.log('There should be ' + orders.length + ' orders in 215');
    console.log('--------------------------------------');
    console.log('note the text displayed above this checklist is the backup csv file of new orders, see below for how to handle if necessary.');
    console.log('--------------------------------------');
    console.log('1.   check to see if an error message is written above, if there is not:');
    console.log('     -   go to the orders folder and open the csv file with your update version number attached to it.');
    console.log('if there is an error message, see wtf it says an also do the following:');
    console.log("     -   copy and paste the csv text above it into a new file, called 'orders{ your_version_number }.csv' in atom in the orders folder.");
    console.log('');
    console.log('2.   if there is no order csv file text above and no new file has been created in the orders folder, then it is because no new orders were created today... or we fucked up...');
  });

});




deliveryList.find({fulfilled: false}, (err, emails) => {

  emailsList = [];

  emails.forEach((email) => {
    emailsList.push(email.customerEmail);
  });
  console.log('Number of emails (this should match the 215 total): ' + emailsList.length);

  let fileLoc = '/Users/hhands/Documents/Projects/genkai/orders/delivery-emails/emails ' + version + '.txt';
  fs.writeFile(fileLoc, emailsList, function(err) {
    if (err) return console.log(err);
  });
});



let date_ob = new Date();
// current date
// adjust 0 before single digit date
let date = ("0" + date_ob.getDate()).slice(-2);

// current month
let month = ("0" + (date_ob.getMonth() + 1)).slice(-2);

// current year
let year = date_ob.getFullYear();

// current hours
let hours = date_ob.getHours();

// current minutes
let minutes = date_ob.getMinutes();

// current seconds
let seconds = date_ob.getSeconds();


let version = year + "-" + month + "-" + date + " " + hours + "h" + minutes + 'm';








const productMapping = {
  todoroki: {
    product_code:"EP01",
    colour:"WH",
    design_pos_front: 'front',
    design_url_front: 'https://www.dropbox.com/s/re7gpcjqdz4og7s/Photo%2009-03-2021%2C%2013%2057%2027%20%282%29.png?dl=0',
    design_pos_back: '',
    design_url_back: ''
  },
  killua:{
    product_code:"EP01",
    colour:"WH",
    design_pos_front: 'front',
    design_url_front: 'https://www.dropbox.com/s/8tvrrydajohbh4x/Photo%2009-03-2021%2C%2013%2056%2018%20%281%29.png?dl=0',
    design_pos_back: '',
    design_url_back: ''
  },
  kakashi: {
    product_code:"EP01",
    colour:"WH",
    design_pos_front: 'front',
    design_url_front: 'https://www.dropbox.com/s/jg6ibnl21tiyzp4/Photo%2009-03-2021%2C%2013%2057%2025.png?dl=0',
    design_pos_back: '',
    design_url_back: ''
  },
  bakugou: {
    product_code:"EP01",
    colour:"WH",
    design_pos_front: 'front',
    design_url_front: 'https://www.dropbox.com/s/eecmu98zscsah6d/Photo%2009-03-2021%2C%2013%2057%2026%20%281%29.png?dl=0',
    design_pos_back: '',
    design_url_back: ''
  },
  sasuke: {
    product_code:"EP01",
    colour:"WH",
    design_pos_front: 'front',
    design_url_front: 'https://www.dropbox.com/s/oayuimmxzg71pny/Photo%2009-03-2021%2C%2013%2057%2026.png?dl=0',
    design_pos_back: '',
    design_url_back: ''
  },
  gon: {
    product_code:"EP01",
    colour:"WH",
    design_pos_front: 'front',
    design_url_front: 'https://www.dropbox.com/s/h6wlbr2y7d9nbp9/Photo%2009-03-2021%2C%2013%2056%2019.png?dl=0',
    design_pos_back: '',
    design_url_back: ''
  },
  levi: {
    product_code:"EP01",
    colour:"WH",
    design_pos_front: 'front',
    design_url_front: 'https://www.dropbox.com/s/rdboul55qyejoa7/Photo%2009-03-2021%2C%2013%2057%2053%20%281%29.png?dl=0',
    design_pos_back: '',
    design_url_back: ''
  },
  tanjiro: {
    product_code:"EP01",
    colour:"WH",
    design_pos_front: 'front',
    design_url_front: 'https://www.dropbox.com/s/ucyzsh0kmhc71xv/Photo%2009-03-2021%2C%2013%2057%2053.png?dl=0',
    design_pos_back: '',
    design_url_back: ''
  },
  luffy:{
    product_code:"EP01",
    colour:"WH",
    design_pos_front: 'front',
    design_url_front: 'https://www.dropbox.com/s/czk2ehz9d80j0wa/Photo%2009-03-2021%2C%2013%2057%2054.png?dl=0',
    design_pos_back: '',
    design_url_back: ''
  },
  itachi:{
    product_code:"EP01",
    colour:"WH",
    design_pos_front: 'front',
    design_url_front: 'https://www.dropbox.com/s/dnqzbzw5bllxnwu/Photo%2009-03-2021%2C%2013%2057%2054%20%281%29.png?dl=0',
    design_pos_back: '',
    design_url_back: ''
  },
  godspeed:{
    product_code:"EP01",
    colour:"WH",
    design_pos_front: 'front',
    design_url_front: 'https://www.dropbox.com/s/1c1fwtf5y879cl7/Photo%2009-03-2021%2C%2013%2056%2017%20%281%29.png?dl=0',
    design_pos_back: '',
    design_url_back: ''
  },
  sukuna:{
    product_code:"EP01",
    colour:"WH",
    design_pos_front: 'front',
    design_url_front: 'https://www.dropbox.com/s/boxw5t0tt5sxv9r/Photo%2009-03-2021%2C%2013%2056%2018.png?dl=0',
    design_pos_back: '',
    design_url_back: ''
  },
  naruto:{
    product_code:"EP01",
    colour:"WH",
    design_pos_front: 'front',
    design_url_front: 'https://www.dropbox.com/s/1413uy4k8h77oap/Photo%2009-03-2021%2C%2013%2057%2028.png?dl=0',
    design_pos_back: '',
    design_url_back: ''
  },
  zoro:{
    product_code:"EP01",
    colour:"WH",
    design_pos_front: 'front',
    design_url_front: 'https://www.dropbox.com/s/2qbln3vik7reqtd/Photo%2009-03-2021%2C%2013%2057%2027.png?dl=0',
    design_pos_back: '',
    design_url_back: ''
  },
  sanji:{
    product_code:"EP01",
    colour:"WH",
    design_pos_front: 'front',
    design_url_front: 'https://www.dropbox.com/s/p4muci7nuugexlf/Photo%2009-03-2021%2C%2013%2056%2017.png?dl=0',
    design_pos_back: '',
    design_url_back: ''
  },
  baam:{
    product_code:"EP01",
    colour:"WH",
    design_pos_front: 'front',
    design_url_front: 'https://www.dropbox.com/s/wa9ystrqxnz5nqx/Photo%2009-03-2021%2C%2013%2057%2054%20%282%29.png?dl=0',
    design_pos_back: '',
    design_url_back: ''
  },
  zenitsu:{
    product_code:"EP01",
    colour:"WH",
    design_pos_front: 'front',
    design_url_front: 'https://www.dropbox.com/s/xmfp4rdjdw4eu2z/Photo%2009-03-2021%2C%2013%2057%2052%20%281%29.png?dl=0',
    design_pos_back: '',
    design_url_back: ''
  },
  rock_lee:{
    product_code:"EP01",
    colour:"WH",
    design_pos_front: 'front',
    design_url_front: 'https://www.dropbox.com/s/8l74vl07h2c336b/Photo%2009-03-2021%2C%2013%2057%2027%20%281%29.png?dl=0',
    design_pos_back: '',
    design_url_back: ''
  },
  nezuko:{
    product_code:"EP01",
    colour:"WH",
    design_pos_front: 'front',
    design_url_front: 'https://www.dropbox.com/s/90izpzatdva0e72/Photo%2009-03-2021%2C%2013%2057%2028%20%281%29.png?dl=0',
    design_pos_back: '',
    design_url_back: ''
  },
  gojo:{
    product_code:"EP01",
    colour:"WH",
    design_pos_front: 'front',
    design_url_front: 'https://www.dropbox.com/s/66lsu0uv1enzgto/Photo%2009-03-2021%2C%2013%2057%2052.png?dl=0',
    design_pos_back: '',
    design_url_back: ''
  },
  genkai:{
    product_code:"EP01",
    colour:"WH",
    design_pos_front: 'front',
    design_url_front: 'https://www.dropbox.com/s/p6458qsa2gursot/Photo%2009-03-2021%2C%2013%2057%2055.png?dl=0',
    design_pos_back: '',
    design_url_back: ''
  },
  one_punch:{
    product_code:"BY011",
    colour:"WHI",
    design_pos_front: 'front',
    design_url_front: 'https://www.dropbox.com/s/lsxbn80mrk27vc6/Photo%2005-02-2021%2C%2022%2048%2059.png?dl=0',
    design_pos_back: '',
    design_url_back: ''
  },
  rivals:{
    product_code:"BY011",
    colour:"WHI",
    design_pos_front: 'front',
    design_url_front: 'https://www.dropbox.com/s/hmurt82fwfifdhc/Photo%2005-02-2021%2C%2022%2054%2031.png?dl=0',
    design_pos_back: '',
    design_url_back: ''
  },
  jokeman:{
    product_code:"BY011",
    colour:"BL",
    design_pos_front: 'front',
    design_url_front: 'https://www.dropbox.com/s/1t5yg8tgdh4nrhs/Hisoka%20front.png?dl=0',
    design_pos_back: 'back',
    design_url_back: 'https://www.dropbox.com/s/aicsekrl73d8phr/Hisoka.png?dl=0'
  }
};







const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`Application is running on ${port}`);
});
