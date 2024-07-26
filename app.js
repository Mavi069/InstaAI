// Include Firebase SDK in your HTML file
// <script src="https://www.gstatic.com/firebasejs/8.6.8/firebase-app.js"></script>
// <script src="https://www.gstatic.com/firebasejs/8.6.8/firebase-database.js"></script>

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyCoLW0wt_zpuAvuXgkMhwGGzpUSmnk1yfI",
    authDomain: "insta-ai-6880d.firebaseapp.com",
    databaseURL: "https://insta-ai-6880d-default-rtdb.firebaseio.com",
    projectId: "insta-ai-6880d",
    storageBucket: "insta-ai-6880d.appspot.com",
    messagingSenderId: "1045284855048",
    appId: "1:1045284855048:web:cd310fe4324ec6e46da0bd",
    measurementId: "G-X17SBQEGRZ"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// Load models
Promise.all([
    faceapi.nets.faceRecognitionNet.loadFromUri('/models'),
    faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
    faceapi.nets.ssdMobilenetv1.loadFromUri('/models')
]).then(startApp);

async function startApp() {
    // Authentication UI
    const authContainer = document.getElementById('auth-container');
    const appContainer = document.getElementById('app-container');
    const loginBtn = document.getElementById('loginBtn');
    const registerBtn = document.getElementById('registerBtn');
    const logoutBtn = document.getElementById('logoutBtn');

    // Auth state listener
    firebase.auth().onAuthStateChanged(user => {
        if (user) {
            authContainer.style.display = 'none';
            appContainer.style.display = 'block';
        } else {
            authContainer.style.display = 'block';
            appContainer.style.display = 'none';
        }
    });

    // Login
    if (loginBtn) {
        loginBtn.addEventListener('click', () => {
            const email = document.getElementById('loginEmail').value;
            const password = document.getElementById('loginPassword').value;
            firebase.auth().signInWithEmailAndPassword(email, password)
                .catch(error => console.error(error.message));
        });
    }

    // Register
    if (registerBtn) {
        registerBtn.addEventListener('click', () => {
            const email = document.getElementById('registerEmail').value;
            const password = document.getElementById('registerPassword').value;
            firebase.auth().createUserWithEmailAndPassword(email, password)
                .catch(error => console.error(error.message));
        });
    }

    // Logout
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            firebase.auth().signOut();
        });
    }

    // Other functionalities
    const addPersonBtn = document.getElementById('addPerson');
    if (addPersonBtn) {
        addPersonBtn.addEventListener('click', addPerson);
    }

    const deletePersonBtn = document.getElementById('deletePerson');
    if (deletePersonBtn) {
        deletePersonBtn.addEventListener('click', deletePerson);
    }

    const recognizeBtn = document.getElementById('recognize');
    if (recognizeBtn) {
        recognizeBtn.addEventListener('click', recognizeFace);
    }

    const optimalRecognizeBtn = document.getElementById('optimalRecognize');
    if (optimalRecognizeBtn) {
        optimalRecognizeBtn.addEventListener('click', recognizeFaceOptimal);
    }

    const useCameraBtn = document.getElementById('useCamera');
    if (useCameraBtn) {
        useCameraBtn.addEventListener('click', useCamera);
    }

    const openInstagramBtn = document.getElementById('openInstagram');
    if (openInstagramBtn) {
        openInstagramBtn.addEventListener('click', openInstagramLink);
    }

    const updateInfoBtn = document.getElementById('updateInfo');
    if (updateInfoBtn) {
        updateInfoBtn.addEventListener('click', updatePersonInfo);
    }
}

async function addPerson() {
    const name = document.getElementById('addName').value;
    const instaHandle = document.getElementById('addInstaHandle').value;
    const imageFiles = document.getElementById('addImagePath').files;

    if (imageFiles.length === 0) {
        alert('Please enter at least one image path.');
        return;
    }

    const encodings = [];

    for (const file of imageFiles) {
        const image = await faceapi.bufferToImage(file);
        const detections = await faceapi.detectSingleFace(image).withFaceLandmarks().withFaceDescriptor();
        if (!detections) {
            alert('No face found in the provided images.');
            return;
        }
        encodings.push(detections.descriptor);
    }

    const newData = {
        encodings: encodings.map(encoding => Array.from(encoding)),
        info: `Insta handle: ${instaHandle} Insta link: https://www.instagram.com/${instaHandle}/`
    };

    db.ref('users/' + name).set(newData, (error) => {
        if (error) {
            alert('Data could not be saved.' + error);
        } else {
            alert(`${name} added to the database!`);
        }
    });
}

async function deletePerson() {
    const instaHandle = document.getElementById('deleteInstaHandle').value.trim();
    if (!instaHandle) {
        alert('Please enter an Instagram handle.');
        return;
    }

    try {
        const snapshot = await db.ref('users').orderByChild('info').once('value');
        let userKey = null;
        snapshot.forEach((userSnapshot) => {
            const userInfo = userSnapshot.val().info;
            if (userInfo.includes(`Insta handle: ${instaHandle}`)) {
                userKey = userSnapshot.key;
            }
        });

        if (userKey) {
            db.ref('users/' + userKey).remove((error) => {
                if (error) {
                    alert('Data could not be deleted: ' + error);
                } else {
                    alert(`User with Instagram handle ${instaHandle} deleted from the database!`);
                }
            });
        } else {
            alert('No user found with the provided Instagram handle.');
        }
    } catch (error) {
        alert('Error occurred while deleting the user: ' + error.message);
    }
}

async function recognizeFace() {
    const imageFile = document.getElementById('recognizeImagePath').files[0];
    if (!imageFile) {
        alert('Please upload an image.');
        return;
    }

    try {
        const image = await faceapi.bufferToImage(imageFile);
        const detections = await faceapi.detectAllFaces(image).withFaceLandmarks().withFaceDescriptors();
        if (detections.length === 0) {
            alert('No face found in the provided image.');
            return;
        }

        const snapshot = await db.ref('users').once('value');
        const database = snapshot.val();

        const resultsContainer = document.getElementById('results-container');
        resultsContainer.innerHTML = ''; // Clear previous results

        const matches = [];

        for (const detection of detections) {
            const unknownEncoding = detection.descriptor;
            const faceMatches = [];

            for (const [name, data] of Object.entries(database)) {
                for (const knownEncoding of data.encodings) {
                    const distance = faceapi.euclideanDistance(unknownEncoding, new Float32Array(knownEncoding));
                    if (distance < 0.6) {
                        const info = data.info;
                        const instaHandle = info.split(' ')[2];

                        const instaData = await fetchInstagramData(instaHandle);
                        if (instaData) {
                            const {
                                profile_pic_url_hd: profilePicUrlHd
                            } = instaData;

                            faceMatches.push({
                                name,
                                instaHandle,
                                profilePicUrlHd
                            });
                        } else {
                            faceMatches.push({
                                name,
                                instaHandle,
                                profilePicUrlHd: 'N/A'
                            });
                        }
                    }
                }
            }

            if (faceMatches.length > 0) {
                matches.push(...faceMatches);
            } else {
                matches.push({
                    name: 'Unknown',
                    instaHandle: 'Unknown',
                    profilePicUrlHd: 'N/A'
                });
            }
        }

        if (matches.length > 0) {
            matches.forEach(match => {
                const { name, instaHandle, profilePicUrlHd } = match;
                const instaLink = `https://www.instagram.com/${instaHandle}/`;

                const card = document.createElement('div');
                card.className = 'card';
                card.innerHTML = `
                    <div class="image" style="background-image: url('${profilePicUrlHd}');"></div>
                    <div class="card-info">
                        <span>${instaHandle}</span> <!-- Display Instagram handle here -->
                        <p>${name}</p> <!-- Display name from database here -->
                    </div>
                    <a href="${instaLink}" class="button" target="_blank">Follow</a>
                `;
                resultsContainer.appendChild(card);
            });
        } else {
            const noMatchCard = document.createElement('div');
            noMatchCard.className = 'card';
            noMatchCard.innerHTML = '<div class="card-info"><p>No matches found</p></div>';
            resultsContainer.appendChild(noMatchCard);
        }
    } catch (error) {
        alert('Error occurred during face recognition: ' + error.message);
    }
}

async function recognizeFaceOptimal() {
    const imageFile = document.getElementById('recognizeImagePath').files[0];
    if (!imageFile) {
        alert('Please upload an image.');
        return;
    }

    try {
        const image = await faceapi.bufferToImage(imageFile);
        const detections = await faceapi.detectAllFaces(image).withFaceLandmarks().withFaceDescriptors();
        if (detections.length === 0) {
            alert('No face found in the provided image.');
            return;
        }

        const snapshot = await db.ref('users').once('value');
        const database = snapshot.val();

        const resultsContainer = document.getElementById('results-container');
        resultsContainer.innerHTML = ''; // Clear previous results

        const matches = [];

        for (const detection of detections) {
            const unknownEncoding = detection.descriptor;
            let bestMatch = { distance: Infinity, name: 'Unknown', info: '' };

            for (const [name, data] of Object.entries(database)) {
                for (const knownEncoding of data.encodings) {
                    const distance = faceapi.euclideanDistance(unknownEncoding, new Float32Array(knownEncoding));
                    if (distance < bestMatch.distance) {
                        bestMatch = { distance, name, info: data.info };
                    }
                }
            }

            if (bestMatch.distance < 0.6) {
                const instaHandle = bestMatch.info.split(' ')[2];
                const instaData = await fetchInstagramData(instaHandle);
                if (instaData) {
                    const { profile_pic_url_hd: profilePicUrlHd } = instaData;

                    matches.push({
                        name: bestMatch.name,
                        instaHandle,
                        profilePicUrlHd
                    });
                } else {
                    matches.push({
                        name: bestMatch.name,
                        instaHandle,
                        profilePicUrlHd: 'N/A'
                    });
                }
            } else {
                matches.push({
                    name: 'Unknown',
                    instaHandle: 'Unknown',
                    profilePicUrlHd: 'N/A'
                });
            }
        }

        if (matches.length > 0) {
            matches.forEach(match => {
                const { name, instaHandle, profilePicUrlHd } = match;
                const instaLink = `https://www.instagram.com/${instaHandle}/`;

                const card = document.createElement('div');
                card.className = 'card';
                card.innerHTML = `
                    <div class="image" style="background-image: url('${profilePicUrlHd}');"></div>
                    <div class="card-info">
                        <span>${instaHandle}</span> <!-- Display Instagram handle here -->
                        <p>${name}</p> <!-- Display name from database here -->
                    </div>
                    <a href="${instaLink}" class="button" target="_blank">Follow</a>
                `;
                resultsContainer.appendChild(card);
            });
        } else {
            const noMatchCard = document.createElement('div');
            noMatchCard.className = 'card';
            noMatchCard.innerHTML = '<div class="card-info"><p>No matches found</p></div>';
            resultsContainer.appendChild(noMatchCard);
        }
    } catch (error) {
        alert('Error occurred during face recognition: ' + error.message);
    }
}

async function useCamera() {
    const video = document.getElementById('video');
    const startCameraBtn = document.getElementById('startCamera');
    const stopCameraBtn = document.getElementById('stopCamera');

    navigator.mediaDevices.getUserMedia({ video: {} })
        .then(stream => {
            video.srcObject = stream;
        })
        .catch(err => {
            alert('Could not access the camera: ' + err);
        });

    startCameraBtn.addEventListener('click', () => {
        video.play();
    });

    stopCameraBtn.addEventListener('click', () => {
        const stream = video.srcObject;
        const tracks = stream.getTracks();

        tracks.forEach(track => {
            track.stop();
        });

        video.srcObject = null;
    });
}

async function openInstagramLink() {
    const instaHandle = document.getElementById('instaHandleToOpen').value.trim();
    if (!instaHandle) {
        alert('Please enter an Instagram handle.');
        return;
    }

    const instaLink = `https://www.instagram.com/${instaHandle}/`;
    window.open(instaLink, '_blank');
}

async function fetchInstagramData(instaHandle) {
    try {
        const response = await fetch(`https://www.instagram.com/${instaHandle}/?__a=1`);
        if (!response.ok) throw new Error('Network response was not ok');
        const data = await response.json();
        return data.graphql.user;
    } catch (error) {
        console.error('Error fetching Instagram data:', error);
        return null;
    }
}

async function updatePersonInfo() {
    const currentInstaHandle = document.getElementById('currentInstaHandle').value.trim();
    const newName = document.getElementById('newName').value.trim();
    const newInstaHandle = document.getElementById('newInstaHandle').value.trim();
    const newImageFiles = document.getElementById('newImagePath').files;

    if (!currentInstaHandle || !newName || !newInstaHandle) {
        alert('Please fill in all fields.');
        return;
    }

    try {
        // Find the user in the database
        const snapshot = await db.ref('users').orderByChild('info').once('value');
        let userKey = null;
        let userData = null;

        snapshot.forEach((userSnapshot) => {
            const userInfo = userSnapshot.val().info;
            if (userInfo.includes(`Insta handle: ${currentInstaHandle}`)) {
                userKey = userSnapshot.key;
                userData = userSnapshot.val();
            }
        });

        if (!userKey) {
            alert('No user found with the provided Instagram handle.');
            return;
        }

        // Update image encodings if new images are provided
        if (newImageFiles.length > 0) {
            const newEncodings = [];
            for (const file of newImageFiles) {
                const image = await faceapi.bufferToImage(file);
                const detections = await faceapi.detectSingleFace(image).withFaceLandmarks().withFaceDescriptor();
                if (detections) {
                    newEncodings.push(detections.descriptor);
                } else {
                    alert('No face found in one of the new images.');
                    return;
                }
            }
            userData.encodings = newEncodings.map(encoding => Array.from(encoding));
        }

        // Update info
        userData.info = `Insta handle: ${newInstaHandle} Insta link: https://www.instagram.com/${newInstaHandle}/`;

        // Update the user's data in the database
        db.ref('users/' + userKey).set(userData, (error) => {
            if (error) {
                alert('Data could not be updated: ' + error);
            } else {
                alert('User information updated successfully!');
            }
        });
    } catch (error) {
        alert('Error occurred while updating the user: ' + error.message);
    }
}
