import { useEffect, useRef, useState, useCallback } from 'react';
import socket from '../config/socket';

export function useVoiceChat(roomCode: string) {
    const [error, setError] = useState('');
    const [isSpeaking, setIsSpeaking] = useState(false);

    // Peer connections mapped by socketId
    const peersRef = useRef<Record<string, RTCPeerConnection>>({});

    // Audio elements mapped by socketId
    const audioRefs = useRef<Record<string, HTMLAudioElement>>({});

    const localStreamRef = useRef<MediaStream | null>(null);

    useEffect(() => {
        if (!roomCode) return;
        socket.emit('webrtc:join');

        return () => {
            if (localStreamRef.current) {
                localStreamRef.current.getTracks().forEach(track => track.stop());
            }
            Object.values(peersRef.current).forEach(p => p.close());
            Object.values(audioRefs.current).forEach(a => a.srcObject = null);
        };
    }, [roomCode]);

    useEffect(() => {
        const createPeer = (peerSocketId: string, initiator: boolean) => {
            if (peersRef.current[peerSocketId]) {
                peersRef.current[peerSocketId].close();
            }

            const peer = new RTCPeerConnection({
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' }
                ]
            });
            peersRef.current[peerSocketId] = peer;

            peer.onnegotiationneeded = async () => {
                try {
                    const offer = await peer.createOffer();
                    await peer.setLocalDescription(offer);
                    socket.emit('webrtc:signal', {
                        to: peerSocketId,
                        type: 'offer',
                        data: peer.localDescription
                    });
                } catch (err) {
                    console.error("Negotiation error", err);
                }
            };

            peer.onicecandidate = e => {
                if (e.candidate) {
                    socket.emit('webrtc:signal', {
                        to: peerSocketId,
                        type: 'candidate',
                        data: e.candidate
                    });
                }
            };

            peer.ontrack = e => {
                let audioEntry = audioRefs.current[peerSocketId];
                if (!audioEntry) {
                    audioEntry = new Audio();
                    audioEntry.autoplay = true;
                    document.body.appendChild(audioEntry);
                    audioRefs.current[peerSocketId] = audioEntry;
                }
                if (e.streams && e.streams[0]) {
                    audioEntry.srcObject = e.streams[0];
                } else {
                    const newStream = new MediaStream([e.track]);
                    audioEntry.srcObject = newStream;
                }
            };

            // Remove the manual createOffer for initiator; onnegotiationneeded handles it
            if (initiator) {
                // If we already have a stream when joining, add it
                if (localStreamRef.current) {
                    localStreamRef.current.getTracks().forEach(track => {
                        peer.addTrack(track, localStreamRef.current!);
                    });
                } else {
                    // Just to trigger initial connection without tracks
                    peer.addTransceiver('audio', { direction: 'recvonly' });
                }
            }

            return peer;
        };

        const onUserJoined = ({ socketId }: { socketId: string }) => {
            createPeer(socketId, true);
        };

        const onSignal = async ({ from, type, data }: { from: string, type: string, data: any }) => {
            let peer = peersRef.current[from];

            if (type === 'offer') {
                if (!peer) peer = createPeer(from, false);
                await peer.setRemoteDescription(new RTCSessionDescription(data));
                const answer = await peer.createAnswer();
                await peer.setLocalDescription(answer);
                socket.emit('webrtc:signal', {
                    to: from,
                    type: 'answer',
                    data: peer.localDescription
                });
            } else if (type === 'answer') {
                if (peer) {
                    await peer.setRemoteDescription(new RTCSessionDescription(data));
                }
            } else if (type === 'candidate') {
                if (peer) {
                    await peer.addIceCandidate(new RTCIceCandidate(data));
                }
            }
        };

        socket.on('webrtc:user_joined', onUserJoined);
        socket.on('webrtc:signal', onSignal);

        return () => {
            socket.off('webrtc:user_joined', onUserJoined);
            socket.off('webrtc:signal', onSignal);
        };
    }, []);

    const startSpeaking = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
            localStreamRef.current = stream;

            stream.getTracks().forEach(track => {
                Object.values(peersRef.current).forEach(peer => {
                    // Add track to all existing peers (triggers onnegotiationneeded)
                    peer.addTrack(track, stream);
                });
            });
            setIsSpeaking(true);
            setError('');
        } catch (err) {
            console.error(err);
            setError("Mic access denied");
        }
    }, []);

    const stopSpeaking = useCallback(() => {
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => {
                track.stop();
                Object.values(peersRef.current).forEach(peer => {
                    const sender = peer.getSenders().find(s => s.track === track);
                    if (sender) {
                        peer.removeTrack(sender); // Triggers onnegotiationneeded
                    }
                });
            });
            localStreamRef.current = null;
        }
        setIsSpeaking(false);
    }, []);

    return { error, isSpeaking, startSpeaking, stopSpeaking };
}
