'use client';
import styles from './Skeleton.module.css';

export function SkeletonCard() {
  return (
    <div className={styles.card}>
      <div className={styles.cover} />
      <div className={styles.title} />
      <div className={styles.artist} />
    </div>
  );
}

export function SkeletonTitle() {
  return <div className={styles.sectionTitleSkeleton} />;
}

export function SkeletonCategory() {
  return (
    <div className={styles.categoryPillSkeleton} />
  );
}
