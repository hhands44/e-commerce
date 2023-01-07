// // add new color to menu when toggled
// $('.menu').click(function() {
//
//   $('.navbar').toggleClass('clicked');
//   $('.sale-header-box').toggleClass('hide-sale-box');
//
//   if ($('#shopping-bag-img').attr('src') === 'images/shopping-bag.png') {
//     $('#shopping-bag-img').attr('src', 'images/shopping-bag-white.png');
//   }
//   else {
//     $('#shopping-bag-img').attr('src', 'images/shopping-bag.png');
//   }
//
//   if ($('#drawn-menu-toggler').attr('src') === 'images/black-menu.png') {
//     $('#drawn-menu-toggler').attr('src', 'images/white-menu.png');
//   }
//   else {
//     $('#drawn-menu-toggler').attr('src', 'images/black-menu.png');
//   }
//
// });


// load more products on scroll
// $(window).scroll(function() {
//     if($(window).scrollTop() == $(document).height() - $(window).height()) {
//            // ajax call get data from server and append to the div
//            console.log('at bottom');
//     }
// });


// add product image change on mouseover
$("document").ready(function() {
  $(".product-img img").mouseenter(function() {
    $(this).attr('src', (index, attr) => {
      return attr.replace('.png', '-design.png');
    });
  });
  $(".product-img img").mouseleave(function() {
    $(this).attr('src', (index, attr) => {
      return attr.replace('-design.png', '.png');
    });
  });
});


// const mouseoverChange = function() {
//   $(this).attr('src', (index, attr) => {
//     return attr.replace('.png', '-design.png');
// };

// setTimeout((this) => {
//   $(this).attr('src', (index, attr) => {
//     return attr.replace('.png', '-design.png');
//   });
// }, 200);




// change product image on product page on alt-img click:

$("document").ready(function() {

  const stdImg = $('#active-img').attr('src');
  const designImg = stdImg.replace('.png', '-design.png');
  const backImg = stdImg.replace('.png', '-back.png');

  $("#alt1").on('click', function() {
    $('#active-img').attr('src', stdImg);
  });

  $("#alt2").on('click', function() {
    $('#active-img').attr('src', designImg);
  });

  $("#alt3").on('click', function() {
    $('#active-img').attr('src', backImg);
  });

});



// fade out the display grid on store page
$(window).scroll(function() {

  var homeTop = $(window).scrollTop();

  $(".product-choice").each(function() {
    var height = $(this).height();
    var offset = $(this).offset().top;
    var opacity = (height - homeTop + offset / 4) / height;


    $(this).css("opacity", opacity);

    // this isn't working
      // while (opacity < 0) {
      //   $(this).css('display', 'none');
      // }
      //
      // while (opacity >= 0) {
      //   $(this).css('display', 'flex');
      // }

  });

  // $(".products-container").each(function() {
  //   var containerHeight = $(this).height();
  //   // console.log(containerHeight);
  //   if (homeTop == containerHeight - $(window).height()) {
  //          // ajax call get data from server and append to the div
  //
  //          console.log('scrolled to bottom');
  //        }
  //     });

});







// ---------------------- Stripe

var stripe = Stripe('pk_live_51HqiU9H03EXJ1RKIGWTnwZkZEIlZo9klC6XzbJFbgI8MQwRI2jXPIdtN17EAEuCGeNDZNXNsY6qkDb0lM9hMn76Q00dxk14Jf7');
var checkoutButton = document.getElementById('checkout-button');

checkoutButton.addEventListener('click', function() {
  // Create a new Checkout Session using the server-side endpoint you
  // created in step 3.
  fetch('/create-checkout-session', {
      method: 'POST'
    })
    .then((response) => response.json())
    .then((session) => {
      stripe.redirectToCheckout({sessionId: session.id});
    })
    .then(function(result) {
      // If `redirectToCheckout` fails due to a browser or network
      // error, you should display the localized error message to your
      // customer using `error.message`.
      if (result.error) {
        alert(result.error.message);
      }
    })
    .catch(function(error) {
      console.error('Error:', error);
    });

});
