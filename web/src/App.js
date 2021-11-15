import React, { 
  useState,
  useEffect
} from 'react';

export function fetchJson(...args) {
  return fetch(...args)
    .then((res) => {
      if (res.ok) {
        return res.json();
      }
      console.error(`Response error ${res.statusText}`);
      throw new Error(`Response error ${res.statusText}`);
    });
}

function NameField({
  name,
  setName,
  nameFieldError,
}) {
  return (
    <form id="name-form" className="col-md-6">
      <div className="form-group">
        <label htmlFor="name-field">Your Name</label>
        <input type="text" id="name-field" className="form-control"
          value={name}
          onChange={(e) => setName(e.target.value)} />
        {nameFieldError !== false && (
          <span>{nameFieldError}</span>
        )}
      </div>
    </form>
  );
}

function AvailableTimes({
  availability,
  name,
  addBooking,
}) {
  return (
    <>
      <h2>Available Times</h2>
      {availability.pending && <p>Loading...</p>}
      {availability.error && <p>Could not load availability. Please try again.</p>}
      {availability.complete && (
        <table className="advisors table">
          <thead>
            <tr>
              <th>Advisor ID</th>
              <th>Available Times</th>
            </tr>
          </thead>
          <tbody>
            {availability.data.map(({advisorId, times}) => (
              <tr key={advisorId}>
                <td>{advisorId}</td>
                <td>
                  <ul className="list-unstyled">
                    {times.map((time) => (
                      <li key={time}>
                        <time dateTime={time} className="book-time">{time}</time>
                        <button className="book btn-small btn-primary" onClick={() => addBooking(name, advisorId, time)}>
                          Book
                        </button>
                      </li>
                    ))}
                  </ul>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  )
}

function BookingTimes({
  bookings,
}) {
  return (
    <>
      <h2>Booked Times</h2>
      {bookings.pending && <p>Loading...</p>}
      {bookings.error && <p>Could not load bookings. Please try again.</p>}
      {bookings.complete && (
        <table className="bookings table">
          <thead>
            <tr>
              <th>Advisor ID</th>
              <th>Student Name</th>
              <th>Date/Time</th>
            </tr>
          </thead>
          <tbody>
            {bookings.data.bookings.map(({ name, time, advisorId }, idx) => (
              <tr key={idx}>
                <td>{advisorId}</td>
                <td>{name}</td>
                <td>
                  <time dateTime="{time}">{time}</time>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  )
}

function App() {
  const [name, setName] = useState('');
  const [nameFieldError, setNameFieldError] = useState(false); // false|string

  // {[idle|pending|complete|error]: true, data: string, errorMessage: string}
  const [today, setToday] = useState({idle: true});
  const [availability, setAvailability] = useState({idle: true});
  const [bookings, setBookings] = useState({idle: true});

  function addBooking(name, advisorId, time) {
    if (name === '') {
      setNameFieldError('Please enter your name.');
      return;
    }

    setNameFieldError(false);

    fetchJson(
      'http://localhost:4433/bookings',
      {
        method: 'POST',
        mode: 'cors',
        body: JSON.stringify({ name, advisorId, time }),
        headers: { 'Content-Type': 'application/json' }
      }
    )
    .catch((e) => {
      setNameFieldError('There was a problem. Please try again.');
    })
    .then(res => {
      if (res.error) {
        setNameFieldError(res.error.message);
        return;
      }
      // Refresh form and data
      setName('');
      sync();
    });
  }

  function sync() {
    // Today
    setToday({ pending: true });
    fetchJson('http://localhost:4433/today')
      .then(data => {
        setToday({ complete: true, data: data.today })
      })
      .catch(err => {
        setToday({ error: true })
      });

    // Availability
    setAvailability({ pending: true });
    fetchJson('http://localhost:4433/availability')
      .then(data => {
        setAvailability({ complete: true, data: data.availability })
      })
      .catch(err => {
        setAvailability({ error: true })
      });

    // Bookings
    setBookings({ pending: true });
    fetchJson('http://localhost:4433/bookings')
      .then(data => {
        setBookings({ complete: true, data })
      })
      .catch(err => {
        setBookings({ error: true })
      });
  }

  useEffect(() => {
    sync();
  }, []);

  return (
    <div className="App container">
      <h1>Book Time with an Advisor</h1>

      {today.status === 'complete' && <span id="today">Today is {today.data}.</span>}

      {NameField({name, setName, nameFieldError})}
      {AvailableTimes({availability, name, addBooking})}
      {BookingTimes({bookings})}
    </div>
  );
}

export default App;
