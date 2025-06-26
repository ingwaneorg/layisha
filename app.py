import os
import uuid
import secrets
from datetime import datetime
from flask import Flask, request, jsonify
from flask_cors import CORS
from google.cloud import storage
from werkzeug.utils import secure_filename
import mimetypes

app = Flask(__name__)
app.secret_key = os.environ.get('SECRET_KEY', 'fallback-for-development')

# Enviroment variables
BUCKET_NAME = os.getenv('GCS_BUCKET_NAME', 'ingwane-layisha')
API_KEY = os.getenv('LAYISHA_API_KEY')

# Configuration
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB in bytes
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}
ALLOWED_MIME_TYPES = {
    'image/png', 'image/jpeg', 'image/jpg', 
    'image/gif', 'image/webp'
}

# CORS configuration
CORS(app, origins=[
    'https://ingwane.org',
    'http://localhost:8000',
    'http://127.0.0.1:8000',
    'http://192.168.1.227:8000',
    'http://192.168.1.229:8000',
])

# Initialize Google Cloud Storage client in not in debug
if not app.debug:
    storage_client = storage.Client()
else:
    storage_client = None  # Won't be used in debug (local testing) mode


def allowed_file(filename):
    """Check if the file extension is allowed."""
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def allowed_mime_type(mime_type):
    """Check if the MIME type is allowed."""
    return mime_type in ALLOWED_MIME_TYPES

def generate_filename(original_filename):
    """Generate a unique filename while preserving the extension."""
    # Get file extension
    if '.' in original_filename:
        extension = original_filename.rsplit('.', 1)[1].lower()
    else:
        extension = 'png'  # Default extension

    # Generate short random filename with YYMMDD in front
    timestamp = datetime.now().strftime('%y%m%d')
    random_name = secrets.token_urlsafe(4)  # 6 chars
    return f"{timestamp}-{random_name}.{extension}"
    
def validate_api_key():
    """Validate the API key from the Authorization header."""
    if not API_KEY:
        return False, "Server configuration error: API key not set"
    
    auth_header = request.headers.get('Authorization')
    if not auth_header:
        return False, "Authorization header required"
    
    if not auth_header.startswith('Bearer '):
        return False, "Bearer token required"
    
    token = auth_header[7:]  # Remove 'Bearer ' prefix
    if token != API_KEY:
        return False, "Invalid API key"
    
    return True, None

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint."""
    return jsonify({
        'status': 'healthy',
        'service': 'layisha-backend',
        'bucket': BUCKET_NAME
    })

@app.route('/upload', methods=['POST'])
def upload_image():
    """Upload an image to Google Cloud Storage."""
    
    # Validate API key
    valid, error = validate_api_key()
    if not valid:
        return jsonify({'error': error}), 401
    
    # Check if file is in request
    if 'image' not in request.files:
        return jsonify({'error': 'No image file provided'}), 400
    
    file = request.files['image']
    
    # Check if file was actually selected
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    
    # Validate file size
    if request.content_length and request.content_length > MAX_FILE_SIZE:
        return jsonify({'error': 'File too large. Maximum size is 10MB'}), 413
    
    # Read file data to check actual size
    file_data = file.read()
    if len(file_data) > MAX_FILE_SIZE:
        return jsonify({'error': 'File too large. Maximum size is 10MB'}), 413
    
    # Reset file pointer
    file.seek(0)
    
    # Validate file type by extension
    if not allowed_file(file.filename):
        return jsonify({'error': 'Invalid file type. Allowed: PNG, JPG, GIF, WebP'}), 400
    
    # Validate MIME type
    mime_type, _ = mimetypes.guess_type(file.filename)
    if not mime_type or not allowed_mime_type(mime_type):
        return jsonify({'error': 'Invalid file type. Must be an image'}), 400

    # Generate unique filename
    filename = generate_filename(file.filename)

    if app.debug:
        # mock uploading the file
        app.logger.info(f"TESTING (debug={app.debug}): Would upload {filename} ({len(file_data)} bytes)")
        public_url = f"https://storage.googleapis.com/{BUCKET_NAME}/{filename}"

    else:
        try:
            if storage_client is None:
                raise Exception("GCS client not initialized")

            bucket = storage_client.bucket(BUCKET_NAME)
            blob = bucket.blob(filename)
            blob.upload_from_string(file_data, content_type=mime_type)
            public_url = f"https://storage.googleapis.com/{BUCKET_NAME}/{filename}"
        
        except Exception as e:
            app.logger.error(f"Upload failed: {str(e)}")
            return jsonify({'error': 'Upload failed. Please try again.'}), 500

    # Return success response
    return jsonify({
        'success': True,
        'url': public_url,
        'filename': filename,
        'size': len(file_data),
        'content_type': mime_type
    }), 200


@app.route('/upload', methods=['OPTIONS'])
def upload_options():
    """Handle CORS preflight requests."""
    return '', 200

@app.errorhandler(413)
def request_entity_too_large(error):
    """Handle file too large error."""
    return jsonify({'error': 'File too large. Maximum size is 10MB'}), 413

@app.errorhandler(400)
def bad_request(error):
    """Handle bad request errors."""
    return jsonify({'error': 'Bad request'}), 400

@app.errorhandler(500)
def internal_error(error):
    """Handle internal server errors."""
    return jsonify({'error': 'Internal server error'}), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8080))
    debug = os.environ.get('FLASK_DEBUG', 'false').lower() == 'true'
    app.run(host='0.0.0.0', port=port, debug=debug)
