const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const fetch = require('node-fetch');

function fetchJson(...args) {
  return fetch(...args)
    .then((res) => {
      if (res.ok) {
        return res.json();
      }
      console.error(`Response error ${res.statusText}`);
      throw new Error(`Response error ${res.statusText}`);
    });
}

class BookingItem {
  constructor({ name, advisorId, time }) {
    this.name = name;
    this.advisorId = advisorId;
    this.time = time;
  }

  validate() {
    const fieldErrors = [];
    if (!(typeof this.name === 'string' && this.name.length > 0)) {
      fieldErrors.push({ field: 'name', message: 'Invalid name' })
    }
    if (!(typeof this.advisorId === 'string' && this.advisorId.length > 0)) {
      fieldErrors.push({ field: 'advisorId', message: 'Invalid advisor' })
    }
    if (!(typeof this.time === 'string' && this.time.length === 25)) {
      fieldErrors.push({ field: 'time', message: 'Invalid date' })
    }
    return fieldErrors;
  }

  data() {
    return {
      name: this.name,
      advisorId: this.advisorId,
      time: this.time,
    }
  }
}

function today() {
  return new Date().toLocaleDateString();
}

function fetchAvailability() {
  return fetchJson('https://www.thinkful.com/api/advisors/availability')
}

/**
 * Format availability data.
 * Grouped by advisor, sorted by datetime.
 * 
 * Param data
 *  {
 *    [day: string]: {
 *      [time: string]: [advisorId: number]
 *    },
 *    ...
 *  }
 * 
 * Returns
 *  [
 *    { advisorId: string, times: string[] },
 *    ...
 *  ]
 */
function groupAvailabilityByAdvisor(data) {
  // Group availablility by advisor id
  const availabilityById =
    Object.values(data)
      .flatMap(o => Object.entries(o))
      .reduce((o, [time, id]) => {
        if (!o.hasOwnProperty(id)) o[id] = [];
        o[id].push(time);
        return o;
      }, {});

  // Sort id, availability date
  // Format object
  const availability =
    Object.entries(availabilityById)
      .sort((a, b) => parseInt(a[0], 10) - parseInt(b[0], 10))
      .map(([id, timearr]) => ({
        advisorId: id,
        times: timearr.sort()
      }))

  return availability;
}

/**
 * Filter out availability if found in bookings
 */
function filterAvailabilityByBookings(availability, bookings) {
  return Object.fromEntries(
    Object.entries(availability)
      .map(([date, entries]) => [
        date,
        Object.fromEntries(
          Object.entries(entries).filter(([time, advisorId]) => (
            bookings.find(b => (
              b.time === time &&
              String(b.advisorId) === String(advisorId)
            )) === undefined
          ))
        )
      ])
      .filter(([date, entries]) => Object.keys(entries).length !== 0)
  );
}

/* {name: string, time: string, advisorId: string}[] */
const bookings = [
  new BookingItem({ name: 'John Smith', time: "2019-04-03T10:00:00-04:00", advisorId: "36232" }),

  // new BookingItem({name: 'John Smith', time: '2019-04-05T11:30:00-04:00', advisorId: "417239"}),
  // {name: 'John Smith', time: '2019-04-05T16:00:00-04:00', advisorId: "417239"},
  // {name: 'John Smith', time: '2019-04-05T18:00:00-04:00', advisorId: "417239"},
];

const app = express();
app.use(cors());
app.use(bodyParser.json());

app.get("/today", (req, res) => {
  res.send({
    today: today()
  });
});

app.get('/availability', (req, res) => {
  fetchAvailability()
    .then(availability => {
      res.send({
        availability:
          groupAvailabilityByAdvisor(
            filterAvailabilityByBookings(
              availability,
              bookings
            )
          )
      })
    })
    .catch(error => {
        console.error(error);
        res.status(500).send('API Error.');
    });
});

/**
 * Success response
 *  {
 *    bookings: {name: string, time: string, advisorId: string}[]
 *  }
 */
app.get('/bookings', (req, res) => {
  return res.send({ bookings: bookings.map(e => e.data()) });
});

/**
 * Success response
 *  {name: string, time: string, advisorId: string}
 * 
 * Error response
 *  {
 *    error: true,
 *    message: String,
 *    fieldErrors: {field: string, message: string}[]
 *  }
 */
app.post('/bookings', async (req, res) => {
  // Check data fields
  const booking = new BookingItem(req.body);
  const fieldErrors = booking.validate();
  if (fieldErrors.length > 0) {
    return res.status(200).send({ error: true, message: 'Field errors', fieldErrors });
  }

  // Refresh available
  fetchAvailability()
    .then(availability => {
      // Check if still available
      if (
        Object.values(
          filterAvailabilityByBookings(
            availability,
            bookings
          )
        )
        .flatMap(o => Object.entries(o))
        .find(([time, advisorId]) => {
          booking.time === time &&
            String(booking.advisorId) === String(advisorId)
        }) !== undefined
      ) {
        return res.status(200).send({ error: true, message: 'Booking unavailable' });
      }
      bookings.push(booking);
      res.status(201).send(booking.data());
    })
    .catch(error => {
        console.error(error);
        res.status(500).send('API Error.');
    });
});

app.today = today;
module.exports = app;