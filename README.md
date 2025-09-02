# LocalPlate Waitlist System

A complete, production-ready waitlist system for LocalPlate with referral tracking, social sharing, and admin dashboard. Built with the LocalPlate design system featuring emerald green branding and modern UI patterns.

## 🎨 Features

### User-Facing Features
- **Beautiful Landing Page** - Responsive design with dark mode support
- **Referral System** - Unique referral codes with tracking and rewards
- **Social Sharing** - Built-in Twitter/X, LinkedIn, and email sharing
- **Success Page** - Confetti animation and personalized experience
- **Position Tracking** - Show users their position in the waitlist
- **ZIP Code Collection** - Optional location data for market analysis

### Admin Features
- **Real-time Dashboard** - View signups, referrals, and conversion rates
- **Analytics Charts** - Visualize signup trends over time
- **Top Referrers** - Track most successful referral sources
- **Export Data** - Download waitlist data as CSV
- **Recent Signups** - Monitor latest registrations

### Technical Features
- **Supabase Integration** - Ready for production database
- **LocalStorage Fallback** - Works without backend for demos
- **Dark Mode** - System preference detection and manual toggle
- **Responsive Design** - Mobile-first approach
- **Accessibility** - ARIA labels and keyboard navigation
- **Performance** - Optimized animations and lazy loading

## 🚀 Quick Start

### 1. Local Demo (No Setup Required)

Simply open `index.html` in a browser to see the waitlist in action. Data will be saved to localStorage for demo purposes.

```bash
# Navigate to waitlist directory
cd localplate/waitlist

# Open in browser (Mac)
open index.html

# Open in browser (Windows)
start index.html

# Or use a local server
npx serve .
```

### 2. Production Setup with Supabase

#### Step 1: Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Note your project URL and anon key from Settings > API

#### Step 2: Set Up Database

1. Go to SQL Editor in your Supabase dashboard
2. Copy the contents of `supabase-setup.sql`
3. Run the SQL to create tables and functions

#### Step 3: Configure JavaScript

Edit `waitlist.js` and replace the placeholder values:

```javascript
const SUPABASE_URL = 'https://your-project.supabase.co';
const SUPABASE_ANON_KEY = 'your-anon-key-here';
```

#### Step 4: Deploy

Upload all files to your web server or deploy to services like:
- Vercel
- Netlify
- GitHub Pages
- AWS S3 + CloudFront

## 📁 File Structure

```
waitlist/
├── index.html          # Main waitlist landing page
├── success.html        # Success page after signup
├── admin-panel-x8k9m2q.html  # Admin dashboard (hidden URL)
├── styles.css          # Tailwind-inspired styles
├── waitlist.js         # Main JavaScript functionality
├── config.js           # Configuration file
├── supabase-setup.sql  # Database setup script
├── supabase-simple-rls.sql  # Security policies
├── SIMPLE_SECURITY.md  # Security documentation
└── README.md          # This file
```

## 🎨 Design System

### Colors
- **Primary**: Emerald Green (#10B981)
- **Gradient**: Emerald to Teal (#10B981 → #059669)
- **Dark Mode**: Full dark theme support

### Typography
- **Font**: Inter (Google Fonts)
- **Headings**: Bold, gradient text effects
- **Body**: Clean, readable sizing

### Components
- Cards with rounded corners and shadows
- Smooth hover animations (scale 1.02)
- Loading states with spinners
- Toast notifications

## 🔧 Configuration

### Email Service Integration

Edit `config.js` to add email service:

```javascript
email: {
    provider: 'sendgrid',
    apiKey: 'YOUR_SENDGRID_API_KEY',
    fromEmail: 'hello@localplate.com',
    templates: {
        welcome: 'TEMPLATE_ID_WELCOME'
    }
}
```

### Analytics Integration

Add your analytics IDs to `config.js`:

```javascript
analytics: {
    googleAnalytics: 'G-XXXXXXXXXX',
    plausible: 'localplate.com',
    mixpanel: 'YOUR_TOKEN'
}
```

Then add the corresponding scripts to your HTML files.

## 📊 Database Schema

### Main Table: `waitlist`
- `id` - UUID primary key
- `email` - Unique email address
- `zipcode` - Optional ZIP code
- `referral_code` - Unique referral code for this user
- `referred_by` - Referral code of referrer
- `referral_count` - Number of successful referrals
- `joined_at` - Timestamp of signup
- `position` - Queue position

### Views
- `waitlist_stats` - Aggregated statistics
- `referral_leaderboard` - Top referrers

## 🎯 Marketing Integration

### UTM Tracking
Add UTM parameters to track campaigns:
```
https://localplate.com/waitlist?utm_source=twitter&utm_campaign=launch
```

### Referral Links
Share format:
```
https://localplate.com/waitlist?ref=ABC123
```

### Social Media
Pre-configured sharing for:
- Twitter/X
- LinkedIn
- Email

## 🛠️ Customization

### Modify Success Rewards

Edit the rewards structure in `success.html`:

```javascript
const rewards = {
    1: 'Early Access Badge',
    3: 'One Month Free Premium',
    5: 'LocalPlate Swag Pack',
    10: 'Lifetime Premium Access'
};
```

### Change Launch Date

Update in `config.js`:

```javascript
waitlist: {
    launchDate: '2024-06-01T00:00:00Z'
}
```

### Customize Copy

All user-facing text is in the HTML files and can be easily modified to match your brand voice.

## 📈 Admin Dashboard

Access the admin dashboard at `/admin-panel-x8k9m2q.html` (password protected) to view:
- Total signups count
- Today's signups
- Referral conversion rate
- Signup trends chart
- Top referrers list
- Recent signups table

### Security Note
The admin dashboard is protected with:
- Hidden URL (unguessable filename)
- Password protection (change default password before deploying)
- See `SIMPLE_SECURITY.md` for complete security setup

## 🚢 Deployment Checklist

- [ ] Set up Supabase project
- [ ] Run database setup SQL
- [ ] Update Supabase credentials
- [ ] Configure email service
- [ ] Add analytics tracking
- [ ] Test referral system
- [ ] Change admin password in admin-panel-x8k9m2q.html
- [ ] Run supabase-simple-rls.sql for security policies
- [ ] Set up SSL certificate
- [ ] Configure CDN for assets
- [ ] Test on mobile devices
- [ ] Verify dark mode works
- [ ] Test social sharing
- [ ] Monitor initial signups

## 🤝 Support

For questions or issues with the waitlist system:
1. Check the browser console for errors
2. Verify Supabase credentials are correct
3. Ensure database tables were created
4. Test with localStorage first

## 📄 License

This waitlist system is part of the LocalPlate project. All rights reserved.

---

Built with 💚 for LocalPlate - Eat Out With Confidence