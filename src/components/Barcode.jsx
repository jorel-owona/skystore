import React from 'react';
import ReactBarcode from 'react-barcode';

export default function Barcode({ value, width = 1.5, height = 40, fontSize = 12 }) {
  if (!value) return null;
  
  return (
    <div className="flex justify-center my-2">
      <ReactBarcode 
        value={value} 
        width={width} 
        height={height} 
        fontSize={fontSize} 
        margin={5} 
        background="transparent" 
        lineColor="currentColor" 
        displayValue={true} 
      />
    </div>
  );
}
