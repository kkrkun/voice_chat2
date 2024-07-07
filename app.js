        const database = firebase.database();

        const usernameInput = document.getElementById('username');
        const joinButton = document.getElementById('joinButton');
        const leaveButton = document.getElementById('leaveButton');
        const loginDiv = document.getElementById('login');
        const chatDiv = document.getElementById('chat');
        const participantSpan = document.getElementById('participant');

        let localStream;
        let peerConnection;
        let localUsername;

        // WebRTCの設定
        const configuration = {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' }
          ]
        };

        joinButton.onclick = async () => {
          localUsername = usernameInput.value;
          if (!localUsername) {
            alert('名前を入力してください');
            return;
          }

          loginDiv.style.display = 'none';
          chatDiv.style.display = 'flex';
          participantSpan.innerText = localUsername;

          // メディアストリームを取得
          localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });

          // PeerConnectionを作成
          peerConnection = new RTCPeerConnection(configuration);
          localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

          // ICE候補を処理
          peerConnection.onicecandidate = event => {
            if (event.candidate) {
              database.ref('/candidates').push({
                username: localUsername,
                candidate: event.candidate.toJSON()
              });
            }
          };

          // リモートストリームを受け取る
          peerConnection.ontrack = event => {
            const remoteAudio = document.createElement('audio');
            remoteAudio.srcObject = event.streams[0];
            remoteAudio.autoplay = true;
            document.body.appendChild(remoteAudio);
          };

          // シグナリングの処理
          const offer = await peerConnection.createOffer();
          await peerConnection.setLocalDescription(offer);
          database.ref('/offers').push({
            username: localUsername,
            offer: offer.toJSON()
          });

          // シグナリングデータの監視
          database.ref('/answers').on('child_added', async snapshot => {
            const answer = snapshot.val();
            if (answer.username !== localUsername) {
              const remoteDesc = new RTCSessionDescription(answer.answer);
              await peerConnection.setRemoteDescription(remoteDesc);
            }
          });

          database.ref('/candidates').on('child_added', async snapshot => {
            const candidate = snapshot.val();
            if (candidate.username !== localUsername) {
              try {
                await peerConnection.addIceCandidate(new RTCIceCandidate(candidate.candidate));
              } catch (e) {
                console.error('Error adding received ice candidate', e);
              }
            }
          });
        };

        leaveButton.onclick = () => {
          peerConnection.close();
          localStream.getTracks().forEach(track => track.stop());
          loginDiv.style.display = 'flex';
          chatDiv.style.display = 'none';
          participantSpan.innerText = '';
          database.ref('/offers').remove();
          database.ref('/answers').remove();
          database.ref('/candidates').remove();
        };
