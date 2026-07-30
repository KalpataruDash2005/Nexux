import React, { useEffect, useState } from 'react';
import { getMyProfile, updateMyProfile } from '../services/profileService';
import { StudentProfileDto } from '../types/profile';
import { Link } from 'react-router-dom';

const Profile: React.FC = () => {
  const [profile, setProfile] = useState<StudentProfileDto>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const data = await getMyProfile();
        setProfile(data || {});
      } catch (err) {
        console.error('Failed to fetch profile', err);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setProfile({
      ...profile,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    
    try {
      const updated = await updateMyProfile(profile);
      setProfile(updated);
      setMessage('Profile updated successfully!');
    } catch (err) {
      console.error('Failed to update profile', err);
      setMessage('Failed to update profile. Please try again.');
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(''), 3000);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">
        Loading Profile...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white pb-12">
      <header className="bg-gray-800 border-b border-gray-700 py-4 px-6 flex items-center mb-8">
        <Link to="/dashboard" className="text-gray-400 hover:text-white mr-4 transition-colors">
          &larr; Back to Dashboard
        </Link>
        <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
          My Profile
        </h1>
      </header>
      
      <main className="max-w-4xl mx-auto px-4">
        <div className="bg-gray-800 border border-gray-700 rounded-2xl shadow-xl overflow-hidden">
          <div className="p-8 border-b border-gray-700">
            <h2 className="text-xl font-semibold mb-2">Personal Information</h2>
            <p className="text-sm text-gray-400">Update your resume, skills, and academic background.</p>
          </div>
          
          <form onSubmit={handleSubmit} className="p-8 space-y-6">
            {message && (
              <div className={`p-4 rounded-lg text-sm ${message.includes('success') ? 'bg-green-500/10 text-green-500 border border-green-500/50' : 'bg-red-500/10 text-red-500 border border-red-500/50'}`}>
                {message}
              </div>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">First Name</label>
                <input
                  type="text"
                  name="firstName"
                  value={profile.firstName || ''}
                  onChange={handleChange}
                  className="w-full bg-gray-900 border border-gray-700 text-white rounded-lg px-4 py-2 focus:ring-1 focus:ring-blue-500 outline-none"
                  placeholder="John"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Last Name</label>
                <input
                  type="text"
                  name="lastName"
                  value={profile.lastName || ''}
                  onChange={handleChange}
                  className="w-full bg-gray-900 border border-gray-700 text-white rounded-lg px-4 py-2 focus:ring-1 focus:ring-blue-500 outline-none"
                  placeholder="Doe"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-300 mb-1">University</label>
                <input
                  type="text"
                  name="university"
                  value={profile.university || ''}
                  onChange={handleChange}
                  className="w-full bg-gray-900 border border-gray-700 text-white rounded-lg px-4 py-2 focus:ring-1 focus:ring-blue-500 outline-none"
                  placeholder="State University"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Degree</label>
                <input
                  type="text"
                  name="degree"
                  value={profile.degree || ''}
                  onChange={handleChange}
                  className="w-full bg-gray-900 border border-gray-700 text-white rounded-lg px-4 py-2 focus:ring-1 focus:ring-blue-500 outline-none"
                  placeholder="B.Sc. Computer Science"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Graduation Year</label>
                <input
                  type="number"
                  name="graduationYear"
                  value={profile.graduationYear || ''}
                  onChange={handleChange}
                  className="w-full bg-gray-900 border border-gray-700 text-white rounded-lg px-4 py-2 focus:ring-1 focus:ring-blue-500 outline-none"
                  placeholder="2025"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-300 mb-1">Skills (Comma separated)</label>
                <textarea
                  name="skills"
                  value={profile.skills || ''}
                  onChange={handleChange}
                  rows={3}
                  className="w-full bg-gray-900 border border-gray-700 text-white rounded-lg px-4 py-2 focus:ring-1 focus:ring-blue-500 outline-none"
                  placeholder="Java, React, Spring Boot, SQL"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-300 mb-1">Resume URL (e.g. LinkedIn / Portfolio)</label>
                <input
                  type="url"
                  name="resumeUrl"
                  value={profile.resumeUrl || ''}
                  onChange={handleChange}
                  className="w-full bg-gray-900 border border-gray-700 text-white rounded-lg px-4 py-2 focus:ring-1 focus:ring-blue-500 outline-none"
                  placeholder="https://linkedin.com/in/johndoe"
                />
              </div>
            </div>
            
            <div className="pt-4 border-t border-gray-700 flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
};

export default Profile;
