        // Toast notification system
        function showToast(message) {
            // Create toast container if it doesn't exist
            let toastContainer = document.getElementById('toast-container');
            if (!toastContainer) {
                toastContainer = document.createElement('div');
                toastContainer.id = 'toast-container';
                toastContainer.className = 'fixed top-4 right-4 z-50 flex flex-col gap-2';
                document.body.appendChild(toastContainer);
            }

            // Create toast element
            const toast = document.createElement('div');
            toast.className = 'bg-emerald-600 text-white px-4 py-3 rounded-lg shadow-lg max-w-sm transform translate-x-full transition-transform duration-300 ease-out';
            toast.innerHTML = `
                <div class="flex items-center gap-2">
                    <svg class="w-5 h-5 text-emerald-200" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path>
                    </svg>
                    <span>${message}</span>
                </div>
            `;
            
            toastContainer.appendChild(toast);
            
            // Animate in
            setTimeout(() => {
                toast.classList.remove('translate-x-full');
            }, 10);
            
            // Animate out and remove
            setTimeout(() => {
                toast.classList.add('translate-x-full');
                setTimeout(() => {
                    if (toast.parentNode) {
                        toast.parentNode.removeChild(toast);
                    }
                }, 300);
            }, 3000);
        }

        // Enhanced share functions with UTM tracking
        function getUrlWithUTM(baseUrl, source) {
            const urlObj = new URL(baseUrl, window.location.origin);
            urlObj.searchParams.set('utm_source', source);
            urlObj.searchParams.set('utm_medium', 'referral_button');
            urlObj.searchParams.set('utm_campaign', 'waitlist_share');
            return urlObj.toString();
        }

        function shareX() {
            const url = getUrlWithUTM(document.getElementById('referral-link').value, 'twitter');
            const text = "I just joined the @LocalPlate waitlist! Get verified nutrition data from your favorite local restaurants. Join me:";
            window.open(`https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, '_blank');
        }

        function shareFacebook() {
            const url = getUrlWithUTM(document.getElementById('referral-link').value, 'facebook');
            window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, '_blank');
        }

        function shareLinkedIn() {
            const url = getUrlWithUTM(document.getElementById('referral-link').value, 'linkedin');
            window.open(`https://www.linkedin.com/shareArticle/?url=${encodeURIComponent(url)}`, '_blank');
        }

        function shareInstagram(event) {
            const url = getUrlWithUTM(document.getElementById('referral-link').value, 'instagram');
            const text = "I just joined the LocalPlate waitlist! Get verified nutrition data from your favorite local restaurants. Join me:";
            const composed = `${text} ${url}`;

            // Open Instagram Direct immediately to avoid popup blockers
            const igWebDM = 'https://www.instagram.com/direct/new/';
            const win = window.open(igWebDM, '_blank');

            // Copy composed text
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
                        showToast('Unable to copy link');
                    }
                }
            };
            copyToClipboard();

            // Try app deep link on mobile
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

        function shareBluesky() {
            const url = getUrlWithUTM(document.getElementById('referral-link').value, 'bluesky');
            const text = "I just joined the LocalPlate waitlist! Get verified nutrition data from your favorite local restaurants. Join me:";
            window.open(`https://bsky.app/intent/compose?text=${encodeURIComponent(text + ' ' + url)}`, '_blank');
        }

        function shareWhatsApp() {
            const url = getUrlWithUTM(document.getElementById('referral-link').value, 'whatsapp');
            const text = "I just joined the LocalPlate waitlist! Get verified nutrition data from your favorite local restaurants. Join me:";
            window.open(`https://wa.me/?text=${encodeURIComponent(text + ' ' + url)}`, '_blank');
        }

        function shareThreads() {
            const url = getUrlWithUTM(document.getElementById('referral-link').value, 'threads');
            const text = "I just joined the LocalPlate waitlist! Get verified nutrition data from your favorite local restaurants. Join me:";
            window.open(`https://threads.net/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, '_blank');
        }
