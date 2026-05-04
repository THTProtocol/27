const admin = require("firebase-admin");
const sa = require("./serviceAccountKey.json");
admin.initializeApp({ credential: admin.credential.cert(sa) });
admin.firestore().listCollections()
  .then(cols => cols.forEach(c => console.log("COLLECTION:", c.id)))
  .catch(console.error)
  .finally(() => process.exit(0));
