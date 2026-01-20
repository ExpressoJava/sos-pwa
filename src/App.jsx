import { useEffect, useMemo, useState } from "react";

const STORAGE_NAME = "sos_user_name";
const STORAGE_CONTACTS = "sos_contacts";

function normalizePhone(input) {
  return (input || "").replace(/\D/g, "");
}

function isBlockedNumber(input) {
  const n = normalizePhone(input);
  return ["911", "112", "999", "988"].includes(n);
}

function loadJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function saveJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function loadString(key, fallback = "") {
  return localStorage.getItem(key) ?? fallback;
}

function saveString(key, value) {
  localStorage.setItem(key, value);
}

function mapsLink(lat, lon) {
  return `https://maps.google.com/?q=${lat},${lon}`;
}

export default function App() {
  const [status, setStatus] = useState("");

  const [userName, setUserName] = useState(() =>
    loadString(STORAGE_NAME, "")
  );

  const [contacts, setContacts] = useState(() =>
    loadJson(STORAGE_CONTACTS, [])
  );

  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");

  const [lastMessage, setLastMessage] = useState("");
  const [lastLink, setLastLink] = useState("");

  useEffect(() => {
    saveString(STORAGE_NAME, userName);
  }, [userName]);

  useEffect(() => {
    saveJson(STORAGE_CONTACTS, contacts);
  }, [contacts]);

  const recipientsCsv = useMemo(
    () => contacts.map((c) => c.phone).join(","),
    [contacts]
  );

  function addContact() {
    const phone = contactPhone.trim();
    const digits = normalizePhone(phone);

    if (!phone) {
      setStatus("Enter a phone number.");
      return;
    }

    if (isBlockedNumber(phone)) {
      setStatus("Emergency numbers like 911 cannot be added.");
      return;
    }

    if (digits.length < 7) {
      setStatus("That number looks too short.");
      return;
    }

    const next = [
      ...contacts,
      {
        id: crypto.randomUUID(),
        name: contactName.trim(),
        phone,
      },
    ];

    // Deduplicate by phone
    const seen = new Set();
    const dedup = [];
    for (const c of next) {
      if (!seen.has(c.phone)) {
        seen.add(c.phone);
        dedup.push(c);
      }
    }

    setContacts(dedup);
    setContactName("");
    setContactPhone("");
    setStatus("Contact saved.");
  }

  function removeContact(id) {
    setContacts(contacts.filter((c) => c.id !== id));
    setStatus("Contact removed.");
  }

  async function getLocationOnce() {
    return new Promise((resolve, reject) => {
      if (!("geolocation" in navigator)) {
        reject(new Error("Geolocation not supported."));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (pos) => resolve(pos),
        (err) => reject(err),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    });
  }

  async function sendSOS() {
    if (!contacts.length) {
      setStatus("Add at least one contact first.");
      return;
    }

    setStatus("Getting location…");

    const time = new Date().toLocaleString();
    let link = "";

    try {
      const pos = await getLocationOnce();
      const lat = pos.coords.latitude.toFixed(6);
      const lon = pos.coords.longitude.toFixed(6);
      link = mapsLink(lat, lon);
      setLastLink(link);
    } catch {
      link = "";
      setLastLink("");
    }

    const nameLine = userName
      ? `My name is ${userName}.`
      : "This is an SOS message.";

    const message =
      `${nameLine}\n` +
      `I’m being questioned or detained and may not be able to respond right now.\n` +
      `Please check on me to make sure I’m okay.\n` +
      (link
        ? `My last known location is below:\n${link}\n`
        : `My location is unavailable right now.\n`) +
      `Time: ${time}`;

    setLastMessage(message);

    const smsUrl =
      `sms:${encodeURIComponent(recipientsCsv)}` +
      `?&body=${encodeURIComponent(message)}`;

    setStatus("Opening SMS app (tap Send).");
    window.location.href = smsUrl;
  }

  async function copyMessage() {
    if (!lastMessage) {
      setStatus("Press SOS first.");
      return;
    }
    await navigator.clipboard.writeText(lastMessage);
    setStatus("Message copied.");
  }

  return (
    <div style={{ maxWidth: 700, margin: "30px auto", padding: 16 }}>
      <h1>Quick SOS</h1>
      <p>
        Press SOS to notify your trusted contacts with your location.
        <br />
        <b>This does not contact 911.</b>
      </p>

      <hr />

      <h2>Your Name</h2>
      <input
        value={userName}
        onChange={(e) => setUserName(e.target.value)}
        placeholder="Your name (used in message)"
        style={{ width: "100%", padding: 10 }}
      />

      <hr />

      <h2>Contacts</h2>
      <input
        value={contactName}
        onChange={(e) => setContactName(e.target.value)}
        placeholder="Name (optional)"
        style={{ width: "100%", padding: 10, marginBottom: 6 }}
      />
      <input
        value={contactPhone}
        onChange={(e) => setContactPhone(e.target.value)}
        placeholder="Phone number"
        style={{ width: "100%", padding: 10 }}
      />
      <button onClick={addContact} style={{ marginTop: 8 }}>
        Add Contact
      </button>

      {contacts.length === 0 ? (
        <p>No contacts yet.</p>
      ) : (
        <ul>
          {contacts.map((c) => (
            <li key={c.id}>
              <b>{c.name || "Contact"}</b> — {c.phone}
              <button
                onClick={() => removeContact(c.id)}
                style={{ marginLeft: 8 }}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      <hr />

      <button
        onClick={sendSOS}
        style={{
          width: "100%",
          padding: 16,
          fontSize: 20,
          marginTop: 10,
        }}
      >
        🚨 Send SOS
      </button>

      <button onClick={copyMessage} style={{ marginTop: 10 }}>
        Copy message
      </button>

      {status && (
        <p style={{ marginTop: 12 }}>
          <b>Status:</b> {status}
        </p>
      )}

      {lastMessage && (
        <>
          <h3>Preview</h3>
          <pre style={{ background: "#f7f7f7", padding: 10 }}>
            {lastMessage}
          </pre>
        </>
      )}
    </div>
  );
}
