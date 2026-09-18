import os
import logging
import pandas as pd
import numpy as np
from typing import List, Optional, Dict, Any
from sklearn.feature_extraction.text import TfidfVectorizer
from ..core.config import settings

logger = logging.getLogger("vector_store")

class VectorStoreService:
    def __init__(self):
        self.dataset_path = settings.DATASET_PATH
        self.df: Optional[pd.DataFrame] = None
        self.vectorizer: Optional[TfidfVectorizer] = None
        self.tfidf_matrix = None
        self.id_to_idx: Dict[int, int] = {}
        self.idx_to_id: Dict[int, int] = {}
        self.is_ready: bool = False

    def initialize(self):
        """Builds and loads the vector index from dataset.csv"""
        if self.is_ready:
            return

        if not os.path.exists(self.dataset_path):
            logger.error(f"Dataset not found at {self.dataset_path}")
            return

        logger.info(f"Loading dataset from {self.dataset_path}...")
        self.df = pd.read_csv(self.dataset_path)

        # Fill missing values
        self.df["title"] = self.df["title"].fillna("")
        self.df["genre"] = self.df["genre"].fillna("")
        self.df["overview"] = self.df["overview"].fillna("")
        self.df["vote_average"] = self.df["vote_average"].fillna(0.0)
        self.df["release_date"] = self.df["release_date"].fillna("")
        self.df["popularity"] = self.df["popularity"].fillna(0.0)

        # Combine features with weighted emphasis on title and genre
        corpus = (
            self.df["title"] + " " +
            self.df["title"] + " " +
            self.df["genre"] + " " +
            self.df["genre"] + " " +
            self.df["overview"]
        ).tolist()

        logger.info("Fitting TF-IDF Vectorizer on 10,000 movie catalog...")
        self.vectorizer = TfidfVectorizer(
            stop_words="english",
            max_features=15000,
            sublinear_tf=True,
            ngram_range=(1, 2)
        )
        self.tfidf_matrix = self.vectorizer.fit_transform(corpus)

        # Build index lookups
        for idx, row in self.df.iterrows():
            movie_id = int(row["id"])
            self.id_to_idx[movie_id] = idx
            self.idx_to_id[idx] = movie_id

        self.is_ready = True
        logger.info(f"Vector store initialized with {len(self.df)} movies.")

    def _format_row(self, row) -> dict:
        release_date = str(row.get("release_date", ""))
        year = release_date.split("-")[0] if release_date else ""
        genres = [g.strip() for g in str(row.get("genre", "")).split(",") if g.strip()]

        return {
            "id": int(row["id"]),
            "title": str(row["title"]),
            "overview": str(row["overview"]),
            "poster_url": None,  # Can be enriched via TMDB or constructed
            "backdrop_url": None,
            "release_date": release_date,
            "year": year,
            "vote_average": round(float(row.get("vote_average", 0.0)), 1),
            "vote_count": int(row.get("vote_count", 0)),
            "popularity": float(row.get("popularity", 0.0)),
            "genres": genres,
        }

    def get_movie_by_id(self, movie_id: int) -> Optional[dict]:
        if not self.is_ready:
            self.initialize()
        idx = self.id_to_idx.get(movie_id)
        if idx is None:
            return None
        return self._format_row(self.df.iloc[idx])

    def search_similar(self, movie_id: int, excluded_ids: Optional[List[int]] = None, limit: int = 10) -> List[dict]:
        """
        Finds movies most similar to movie_id, strictly excluding any IDs in excluded_ids.
        """
        if not self.is_ready:
            self.initialize()

        target_idx = self.id_to_idx.get(movie_id)
        if target_idx is None:
            return []

        # Vector dot-product (cosine similarity for normalized TF-IDF)
        target_vector = self.tfidf_matrix[target_idx]
        scores = (self.tfidf_matrix * target_vector.T).toarray().flatten()

        # Always exclude the target movie itself
        scores[target_idx] = -1.0

        # Exclude watched movies
        if excluded_ids:
            for ex_id in excluded_ids:
                ex_idx = self.id_to_idx.get(ex_id)
                if ex_idx is not None:
                    scores[ex_idx] = -1.0

        # Get top indices
        top_indices = np.argsort(scores)[::-1][:limit]
        results = []
        for idx in top_indices:
            if scores[idx] > 0:
                movie = self._format_row(self.df.iloc[idx])
                movie["similarity_score"] = round(float(scores[idx]), 3)
                results.append(movie)

        return results

    def search_by_text(self, query: str, excluded_ids: Optional[List[int]] = None, limit: int = 10) -> List[dict]:
        """
        Natural language semantic search against the catalog.
        """
        if not self.is_ready:
            self.initialize()

        query_vec = self.vectorizer.transform([query])
        scores = (self.tfidf_matrix * query_vec.T).toarray().flatten()

        if excluded_ids:
            for ex_id in excluded_ids:
                ex_idx = self.id_to_idx.get(ex_id)
                if ex_idx is not None:
                    scores[ex_idx] = -1.0

        top_indices = np.argsort(scores)[::-1][:limit]
        results = []
        for idx in top_indices:
            if scores[idx] > 0:
                movie = self._format_row(self.df.iloc[idx])
                movie["similarity_score"] = round(float(scores[idx]), 3)
                results.append(movie)

        return results

    def get_tailored_recommendations(self, liked_movie_ids: List[int], excluded_ids: Optional[List[int]] = None, limit: int = 15) -> List[dict]:
        """
        Computes a personalized user taste centroid from liked movies,
        strictly excluding all movies in excluded_ids (e.g. all watched movies).
        """
        if not self.is_ready:
            self.initialize()

        valid_indices = [self.id_to_idx[mid] for mid in liked_movie_ids if mid in self.id_to_idx]
        if not valid_indices:
            return []

        # Compute centroid vector
        centroid = self.tfidf_matrix[valid_indices].mean(axis=0)
        centroid = np.asarray(centroid)
        scores = (self.tfidf_matrix * centroid.T).flatten()

        # Exclude watched movies and liked movies
        all_excluded = set(excluded_ids or []) | set(liked_movie_ids)
        for ex_id in all_excluded:
            ex_idx = self.id_to_idx.get(ex_id)
            if ex_idx is not None:
                scores[ex_idx] = -1.0

        top_indices = np.argsort(scores)[::-1][:limit]
        results = []
        for idx in top_indices:
            if scores[idx] > 0:
                movie = self._format_row(self.df.iloc[idx])
                movie["similarity_score"] = round(float(scores[idx]), 3)
                results.append(movie)

        return results

vector_store = VectorStoreService()
