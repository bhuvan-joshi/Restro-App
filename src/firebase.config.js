import{getApp, getApps, initializeApp} from "firebase/app"
import{getFirestore} from "firebase/firestore"
import{getStorage} from "firebase/storage"

const firebaseConfig = {
    apiKey: "AIzaSyB3WWyJK6BRWfRRN_eibRRV9PK49LodYQs",
    authDomain: "restaurentapp-598c8.firebaseapp.com",
    databaseURL: "https://restaurentapp-598c8-default-rtdb.firebaseio.com",
    projectId: "restaurentapp-598c8",
    storageBucket: "restaurentapp-598c8.appspot.com",
    messagingSenderId: "430022679415",
    appId: "1:430022679415:web:3d091aec4b92881e7e9f72"
};

const app = getApps.length > 0 ? getApp() : initializeApp(firebaseConfig);

const firestore = getFirestore(app)
const storage = getStorage(app)

export {app, firestore, storage}