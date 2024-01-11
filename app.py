# Import necessary libraries
import streamlit as st  # Streamlit library for creating user interface
import pickle  # Pickle library for loading pickled files
import requests  # Requests library for making HTTP requests
import os  # OS library for interacting with the operating system

def fetch_poster(movie_id):
    """
    This function fetches the poster of a movie using the movie id from the API.
    """
    # Construct the URL for the API request
    url = f"https://api.themoviedb.org/3/movie/{movie_id}?api_key=c7ec19ffdd3279641fb606d19ceb9bb1&language=en-US"
    # Send the HTTP request and get the response data in JSON format
    data = requests.get(url).json()
    # Get the poster path from the response data
    poster_path = data.get('poster_path')
    # If the poster path exists, construct the full path and return it
    if poster_path:
        full_path = f"https://image.tmdb.org/t/p/w500/{poster_path}"
        return full_path
    # Otherwise, return None
    else:
        return None

# Get the absolute path of the script directory
script_dir = os.path.dirname(os.path.abspath(__file__))

# Specify the absolute paths for the pickled files
movies_path = os.path.join(script_dir, "movies_list.pkl")
similarity_path = os.path.join(script_dir, "similarity.pkl")

# Error handling for file loading
try:
    # Load the pickled files
    with open(movies_path, 'rb') as f:
        movies = pickle.load(f)
    with open(similarity_path, 'rb') as f:
        similarity = pickle.load(f)
except FileNotFoundError:
    # If one or both of the required files are not found, display an error message and stop the script
    st.error(f"Error: One or both of the required files are not found. {movies_path}, {similarity_path}")
    st.stop()

# Get the list of movie titles from the loaded data
movies_list = movies['title'].values

# Create the Streamlit user interface
st.header("Movie Recommender System")

# Declare a custom Streamlit component for displaying an image carousel
import streamlit.components.v1 as components
imageCarouselComponent = components.declare_component("image-carousel-component", path="frontend/public")

# Fetch the posters for the recommended movies
imageUrls = [fetch_poster(movie_id) for movie_id in [1632, 299536, 17455, 2830, 429422, 9722, 13972, 240, 155, 598, 914, 255709, 572154] if fetch_poster(movie_id)]

# Display the image carousel component with the fetched posters
imageCarouselComponent(imageUrls=imageUrls, height=200)

# Create a dropdown for selecting a movie
selectvalue = st.selectbox("Select movie from dropdown", movies_list)

def recommend(movie):
    """
    This function recommends five movies based on the selected movie.
    """
    # Get the index of the selected movie in the loaded data
    index = movies[movies['title'] == movie].index[0]
    # Calculate the similarity scores between the selected movie and all other movies
    distance = sorted(list(enumerate(similarity[index])), reverse=True, key=lambda vector: vector[1])
    # Initialize empty lists for the recommended movies and their posters
    recommend_movie = []
    recommend_poster = []
    # Get the titles and posters of the top five most similar movies
    for i in distance[1:6]:
        movies_id = movies.iloc[i[0]].id
        recommend_movie.append(movies.iloc[i[0]].title)
        poster = fetch_poster(movies_id)
        if poster:
            recommend_poster.append(poster)
    # Return the recommended movies and their posters
    return recommend_movie, recommend_poster

# Create a button for showing the recommended movies
if st.button("Show Recommend"):
    # Call the recommend function with the selected movie and get the recommended movies and their posters
    movie_name, movie_poster = recommend(selectvalue)
    # Create five columns for displaying the recommended movies and their posters
    cols = st.columns(5)
    for i, col in enumerate(cols):
        # If there are less than five recommended movies, only display the available ones
        if i < len(movie_name):
            col.text(movie_name[i])
            col.image(movie_poster[i], caption=f"Poster {i+1}", use_column_width=True, output_format='JPEG')
