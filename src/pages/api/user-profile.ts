
import { NextApiRequest, NextApiResponse } from 'next';
import { fetchUserProfile } from "@/api/user-profile";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { userId } = req.query;

  if (!userId || typeof userId !== 'string') {
    return res.status(400).json({ error: 'User ID is required' });
  }

  try {
    const result = await fetchUserProfile(userId);
    
    if (result.error) {
      return res.status(500).json({ error: result.error.message });
    }
    
    return res.status(200).json({ data: result.data });
  } catch (error: any) {
    console.error('Error in user profile API:', error);
    return res.status(500).json({ error: error.message || 'An error occurred' });
  }
}
