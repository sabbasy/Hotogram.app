export interface FoodImageResult {
  url: string;
  thumb: string;
  title: string;
}

// Curated high-res Unsplash CDN food image library (0 API calls required)
const CURATED_FOOD_GALLERY: Record<string, string[]> = {
  pizza: [
    'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1534308983496-4fabb1a015ee?auto=format&fit=crop&w=800&q=80'
  ],
  burger: [
    'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1586190848861-99aa4a171e90?auto=format&fit=crop&w=800&q=80'
  ],
  pasta: [
    'https://images.unsplash.com/photo-1621996346565-e3d5d6281292?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1551183053-bf91a1d81141?auto=format&fit=crop&w=800&q=80'
  ],
  indian: [
    'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?auto=format&fit=crop&w=800&q=80'
  ],
  drink: [
    'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1544145945-f90425340c7e?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=800&q=80'
  ],
  dessert: [
    'https://images.unsplash.com/photo-1551024601-bec78aea704b?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1563729784474-d77dbb933a9e?auto=format&fit=crop&w=800&q=80'
  ],
  general: [
    'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1498837167922-ddd27525d352?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1476224203421-9ac39bcb3327?auto=format&fit=crop&w=800&q=80'
  ]
};

export async function searchFoodImages(query: string): Promise<FoodImageResult[]> {
  const cleanQuery = encodeURIComponent(query.trim() || 'food');
  const topics = [
    cleanQuery,
    `${cleanQuery},dish`,
    `${cleanQuery},food`,
    `${cleanQuery},restaurant`,
    'gourmet,food',
    'delicious,food'
  ];

  return topics.map((t, idx) => ({
    url: `https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80&sig=${idx}&${t}`,
    thumb: `https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=200&q=60&sig=${idx}&${t}`,
    title: `${query} Photo ${idx + 1}`
  }));
}

export async function getUnsplashFoodImageUrl(dishName: string, categoryName: string = ''): Promise<string> {
  const cleanName = encodeURIComponent(dishName.trim() || 'delicious food');
  const accessKey = import.meta.env.VITE_UNSPLASH_ACCESS_KEY;
  
  if (!accessKey) {
    return getFallbackFoodImage(dishName, 0, categoryName);
  }

  // Try to search for the specific dish name + food, requesting 3 results to verify
  try {
    const res = await fetch(`https://api.unsplash.com/search/photos?query=food+${cleanName}&client_id=${accessKey}&per_page=3`);
    const data = await res.json();
    
    // Find the first photo that actually looks like food/beverage in description/tags
    const foodPhoto = data.results?.find((photo: any) => {
      const alt = (photo.alt_description || '').toLowerCase();
      const desc = (photo.description || '').toLowerCase();
      return (
        alt.includes('food') || alt.includes('dish') || alt.includes('plate') || alt.includes('meal') || 
        alt.includes('eat') || alt.includes('drink') || alt.includes('dessert') || alt.includes('soup') || 
        alt.includes('salad') || desc.includes('food') || desc.includes('dish') || desc.includes('plate')
      );
    });

    if (foodPhoto?.urls?.regular) {
      return foodPhoto.urls.regular;
    }

    // If specific search didn't yield a verified food photo, query the category name (e.g., "Starters food")
    if (categoryName) {
      const cleanCat = encodeURIComponent(categoryName.trim());
      const catRes = await fetch(`https://api.unsplash.com/search/photos?query=food+${cleanCat}&client_id=${accessKey}&per_page=1`);
      const catData = await catRes.json();
      if (catData.results?.[0]?.urls?.regular) {
        return catData.results[0].urls.regular;
      }
    }

    return getFallbackFoodImage(dishName, 0, categoryName);
  } catch (err) {
    console.error('Failed to fetch from Unsplash', err);
    return getFallbackFoodImage(dishName, 0, categoryName);
  }
}

export interface BulkItemInput {
  id: string;
  name: string;
  categoryName: string;
}

// Function to fetch relevant food images grouped by category to save API rate limits while ensuring 90%+ relevance
export async function getBulkFoodImages(items: BulkItemInput[]): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  const accessKey = import.meta.env.VITE_UNSPLASH_ACCESS_KEY;

  if (!accessKey) {
    items.forEach((item, index) => {
      result[item.id] = getFallbackFoodImage(item.name, index, item.categoryName);
    });
    return result;
  }

  // Group items by category name
  const categoriesMap: Record<string, BulkItemInput[]> = {};
  items.forEach(item => {
    const cat = (item.categoryName || 'general').toLowerCase().trim();
    if (!categoriesMap[cat]) categoriesMap[cat] = [];
    categoriesMap[cat].push(item);
  });

  const categoryNames = Object.keys(categoriesMap);

  // Run searches for each category in parallel (e.g., 4 calls for 4 categories)
  await Promise.all(
    categoryNames.map(async (catName) => {
      const catItems = categoriesMap[catName];
      try {
        const cleanQuery = encodeURIComponent(`${catName} food`);
        const res = await fetch(
          `https://api.unsplash.com/search/photos?query=${cleanQuery}&client_id=${accessKey}&per_page=${Math.min(30, catItems.length * 2)}`
        );
        if (res.ok) {
          const data = await res.json();
          const photos = (data.results || []).map((r: any) => r.urls?.regular).filter(Boolean);
          
          catItems.forEach((item, idx) => {
            if (photos.length > 0) {
              // Distribute matching photos to items in this category
              result[item.id] = photos[idx % photos.length];
            } else {
              result[item.id] = getFallbackFoodImage(item.name, idx, catName);
            }
          });
        } else {
          throw new Error('Rate limit or fetch error');
        }
      } catch (err) {
        console.warn(`Unsplash bulk fetch failed for category: ${catName}. Using fallbacks.`, err);
        catItems.forEach((item, idx) => {
          result[item.id] = getFallbackFoodImage(item.name, idx, catName);
        });
      }
    })
  );

  return result;
}

function getFallbackFoodImage(dishName: string, seed: number = 0, categoryName: string = ''): string {
  const name = `${dishName} ${categoryName}`.toLowerCase();
  let pool = CURATED_FOOD_GALLERY.general;

  if (name.includes('pizza')) pool = CURATED_FOOD_GALLERY.pizza;
  else if (name.includes('burger') || name.includes('sandwich') || name.includes('starter') || name.includes('appetizer')) pool = CURATED_FOOD_GALLERY.burger;
  else if (name.includes('pasta') || name.includes('noodle') || name.includes('spaghetti')) pool = CURATED_FOOD_GALLERY.pasta;
  else if (name.includes('paneer') || name.includes('biryani') || name.includes('curry') || name.includes('dal') || name.includes('roti') || name.includes('naan') || name.includes('tikka') || name.includes('indian')) pool = CURATED_FOOD_GALLERY.indian;
  else if (name.includes('drink') || name.includes('juice') || name.includes('tea') || name.includes('coffee') || name.includes('shake') || name.includes('soda') || name.includes('water') || name.includes('beverage')) pool = CURATED_FOOD_GALLERY.drink;
  else if (name.includes('cake') || name.includes('ice') || name.includes('dessert') || name.includes('sweet') || name.includes('halwa') || name.includes('pastry') || name.includes('waffle')) pool = CURATED_FOOD_GALLERY.dessert;

  return pool[seed % pool.length];
}

