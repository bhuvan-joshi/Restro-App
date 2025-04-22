import React, { useState } from 'react';
import { Image, Spinner } from 'react-bootstrap';

/**
 * Enhanced ProductImage component for displaying product images with loading state,
 * fallback handling, and modern hover effects
 * 
 * @param {Object} props Component props
 * @param {string} props.src Image source path
 * @param {string} props.alt Alt text for the image
 * @param {string} props.className CSS classes to apply
 * @param {Object} props.style Additional inline styles
 * @param {boolean} props.thumbnail Whether to display as a thumbnail
 * @param {function} props.onClick Click handler for the image
 * @returns {JSX.Element} Enhanced Image component with error handling
 */
const ProductImage = ({ 
  src, 
  alt, 
  className = '', 
  style = {}, 
  thumbnail = false,
  onClick = null
}) => {
  const [imageError, setImageError] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Create a placeholder image for fallback
  const placeholderImage = "data:image/svg+xml;charset=UTF-8,%3Csvg%20width%3D%22200%22%20height%3D%22200%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20200%20200%22%20preserveAspectRatio%3D%22none%22%3E%3Cdefs%3E%3Cstyle%20type%3D%22text%2Fcss%22%3E%23holder_16e10b13b86%20text%20%7B%20fill%3A%23AAAAAA%3Bfont-weight%3Abold%3Bfont-family%3AArial%2C%20Helvetica%2C%20Open%20Sans%2C%20sans-serif%2C%20monospace%3Bfont-size%3A10pt%20%7D%20%3C%2Fstyle%3E%3C%2Fdefs%3E%3Cg%20id%3D%22holder_16e10b13b86%22%3E%3Crect%20width%3D%22200%22%20height%3D%22200%22%20fill%3D%22%23EEEEEE%22%3E%3C%2Frect%3E%3Cg%3E%3Ctext%20x%3D%2272.5%22%20y%3D%22104.5%22%3ENo Image%3C%2Ftext%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fsvg%3E";
  
  // Handle image loading events
  const handleImageError = () => {
    setImageError(true);
    setLoading(false);
  };
  
  const handleImageLoad = () => {
    setLoading(false);
  };
  
  // Construct the proper image URL
  const getImageUrl = () => {
    if (imageError || !src) {
      return placeholderImage;
    }
    
    // If it's already a data URL or absolute URL, use it directly
    if (src.startsWith('data:') || src.startsWith('http://') || src.startsWith('https://')) {
      return src;
    }
    
    // If it starts with a slash, it's a path from the server root
    if (src.startsWith('/')) {
      return src;
    }
    
    // Otherwise, assume it's a relative path
    return `/${src}`;
  };

  // Determine container and image classes
  const containerClasses = `product-image-container ${thumbnail ? 'product-thumbnail' : ''} ${className}`;
  const imageClasses = `product-image fade-in ${loading ? 'd-none' : ''}`;
  
  // Combine styles
  const containerStyle = {
    cursor: onClick ? 'pointer' : 'default',
    ...style
  };
  
  return (
    <div className={containerClasses} style={containerStyle} onClick={onClick}>
      {loading && (
        <div className="image-loading-spinner">
          <Spinner animation="border" variant="primary" size="sm" />
        </div>
      )}
      <Image
        src={getImageUrl()}
        alt={alt || "Product image"}
        className={imageClasses}
        style={{ objectFit: 'contain' }}
        onError={handleImageError}
        onLoad={handleImageLoad}
      />
      {imageError && (
        <div className="image-error-overlay">
          <i className="bi bi-image text-muted"></i>
        </div>
      )}
    </div>
  );
};

export default ProductImage;