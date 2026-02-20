import { useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

/**
 * Reads :id from the URL and opens the corresponding detail modal.
 * If the item isn't found, shows a toast and navigates to the listing.
 */
export default function DeepLinkHandler({ type, fetchById, onSelect, showToast }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const fetchedRef = useRef(null);

  useEffect(() => {
    if (!id || fetchedRef.current === id) return;
    fetchedRef.current = id;

    (async () => {
      const item = await fetchById(id);
      if (item) {
        onSelect(item);
      } else {
        showToast('This item is no longer available', 'info');
        // Navigate to the listing without the :id
        const listingPath = type === 'event' ? '/classes' : type === 'deal' ? '/deals' : '/services';
        navigate(listingPath, { replace: true });
      }
    })();
  }, [id, type, fetchById, onSelect, showToast, navigate]);

  return null;
}
