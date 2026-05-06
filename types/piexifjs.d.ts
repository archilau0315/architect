declare module 'piexifjs' {
  export function load(data: string): any;
  export function dump(exifObj: any): string;
  
  export const ImageIFD: {
    Software: number;
    ImageDescription: number;
    Make: number;
  };
  
  export const ThumbnailIFD: {
    [key: string]: number;
  };
  
  export const ExifIFD: {
    UserComment: number;
    [key: string]: number;
  };
  
  export const GPSEIFD: {
    [key: string]: number;
  };
  
  export const InteropIFD: {
    [key: string]: number;
  };
}