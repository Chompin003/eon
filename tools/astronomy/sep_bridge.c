/* eon adapter, MIT. SEP remains separately replaceable, LGPL-3.0-or-later. */
#include <math.h>
#include <stdlib.h>
#include <string.h>
#include "sep.h"

/* Output rows: x,y,a,b,theta,segment_sum,peak,npix,flags,
 * centroid_var_x,centroid_var_y,centroid_cov_xy,aperture_mean,aperture_error,aperture_flags.
 * Input is a COPY of original IMAGE pixels, never the scientific FITS buffer. */
int eon_extract(float * pixels, unsigned char * mask, int w, int h,
                double threshold, int minarea, double * output, int capacity,
                double * stats) {
  if(w < 8 || h < 8 || w*h > 2097152 || capacity < 1) return -1;
  sep_image im = {0};
  im.data=pixels; im.mask=mask; im.dtype=SEP_TFLOAT; im.mdtype=SEP_TBYTE;
  im.w=w; im.h=h; im.maskthresh=0;
  sep_bkg * bkg=NULL;
  sep_catalog * cat=NULL;
  float * rms=malloc((size_t)w*h*sizeof(float));
  if(!rms) return -1;
  int status=sep_background(&im,w<32?w:32,h<32?h:32,3,3,0,&bkg);
  if(status) goto done;
  stats[0]=sep_bkg_global(bkg); stats[1]=sep_bkg_globalrms(bkg);
  if(!isfinite(stats[1]) || stats[1]<=0) {status=1;goto done;}
  status=sep_bkg_rmsarray(bkg,rms,SEP_TFLOAT);if(status)goto done;
  status=sep_bkg_subarray(bkg,pixels,SEP_TFLOAT);if(status)goto done;
  im.noise=rms; im.ndtype=SEP_TFLOAT; im.noise_type=SEP_NOISE_STDDEV;
  float kernel[9]={1,2,1,2,4,2,1,2,1};
  sep_set_extract_pixstack(300000);sep_set_sub_object_limit(1024);
  status=sep_extract(&im,(float)threshold,SEP_THRESH_REL,minarea,kernel,3,3,
                     SEP_FILTER_CONV,32,1.0,1,1.0,&cat);
  if(status)goto done;
  stats[2]=cat->nobj;
  int count=cat->nobj<capacity?cat->nobj:capacity;
  for(int i=0;i<count;i++) {
    double sum=0,err=0,area=0;short flag=0;
    int phot=sep_sum_circle(&im,cat->x[i],cat->y[i],2.5,0,5,0,&sum,&err,&area,&flag);
    double * row=output+i*15;
    row[0]=cat->x[i];row[1]=cat->y[i];row[2]=cat->a[i];row[3]=cat->b[i];row[4]=cat->theta[i];
    row[5]=cat->flux[i];row[6]=cat->peak[i];row[7]=(double)cat->npix[i];row[8]=cat->flag[i];
    row[9]=cat->errx2[i];row[10]=cat->erry2[i];row[11]=cat->errxy[i];
    row[12]=!phot&&area>0?sum/area:NAN;row[13]=!phot&&area>0?err/area:NAN;row[14]=phot?65535:flag;
  }
done:
  sep_catalog_free(cat);sep_bkg_free(bkg);free(rms);
  return status?-status:0;
}
