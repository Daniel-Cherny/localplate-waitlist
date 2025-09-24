        function shareInstagram(event) {
            const url = document.getElementById('referral-link').value;
            const text = "I just joined the LocalPlate waitlist! Get verified nutrition data from your favorite local restaurants. Join me:";
            const composed = `${text} ${url}`;

            // 1) Open Instagram Direct immediately to avoid popup blockers
            const igWebDM = 'https://www.instagram.com/direct/new/';
            const win = window.open(igWebDM, '_blank');

            // 2) Copy composed text (not just URL)
            const copyToClipboard = async () => {
                try {
                    await navigator.clipboard.writeText(composed);
                    showToast('Copied! Paste in Instagram Direct');
                } catch (err) {
                    // Fallback for older browsers
                    try {
                        const ta = document.createElement('textarea');
                        ta.value = composed;
                        ta.setAttribute('readonly', '');
                        ta.style.position = 'absolute';
                        ta.style.left = '-9999px';
                        document.body.appendChild(ta);
                        ta.select();
                        document.execCommand('copy');
                        document.body.removeChild(ta);
                        showToast('Copied! Paste in Instagram Direct');
                    } catch {
                        console.error('Clipboard copy failed');
                    }
                }
            };
            copyToClipboard();

            // 3) Try app deep link on mobile (best effort)
            try {
                const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
                if (isMobile && win) {
                    setTimeout(() => {
                        try {
                            win.location.href = 'instagram://direct';
                        } catch {
                            // Ignore; web DM is already open
                        }
                    }, 50);
                }
            } catch {
                // Ignore; web DM is already open
            }
        }
