import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;

const JWT_SECRET =
  process.env.JWT_SECRET ||
  'smart-city-secret';

// =========================
// UPLOADS
// =========================
const uploadsDir = path.join(
  __dirname,
  'uploads'
);

if (!fs.existsSync(uploadsDir)) {

  fs.mkdirSync(uploadsDir);
}


// =========================
// DATABASE
// =========================
const db = {

  users: [

    {
      id: '1',

      name: 'Admin User',

      email: 'admin@smartcity.gov',

      password: '',

      role: 'admin'
    }
  ],

  complaints: [] as any[],
};


// ADMIN PASSWORD
bcrypt
  .hash('admin123', 10)
  .then(hash => {

    db.users[0].password =
      hash;
  });


// =========================
// MULTER
// =========================
const storage =
  multer.diskStorage({

    destination: (
      req,
      file,
      cb
    ) => {

      cb(
        null,
        uploadsDir
      );
    },

    filename: (
      req,
      file,
      cb
    ) => {

      cb(
        null,
        `${Date.now()}-${file.originalname}`
      );
    }
  });


const upload = multer({

  storage,

  limits: {

    fileSize:
      5 * 1024 * 1024
  },

  fileFilter: (
    req,
    file,
    cb
  ) => {

    const allowed =
      [
        'image/jpeg',
        'image/png',
        'image/jpg',
        'image/webp'
      ];

    if (
      allowed.includes(
        file.mimetype
      )
    ) {

      cb(null, true);

    } else {

      cb(
        new Error(
          'Only image files allowed'
        )
      );
    }
  }
});


// =========================
// AI IMAGE DETECTION
// =========================
async function detectFakeAIImage(
  filePath: string,
  fileName: string
) {

  const suspiciousKeywords = [

    'ai',
    'generated',
    'midjourney',
    'dalle',
    'stable-diffusion',
    'fake'
  ];


  const lowerName =
    fileName.toLowerCase();


  // FILENAME CHECK
  const suspiciousName =
    suspiciousKeywords.some(
      keyword =>
        lowerName.includes(
          keyword
        )
    );


  // IMAGE ANALYSIS
  const metadata =
    await sharp(filePath)
      .metadata();


  let suspicious = false;

  let reason = '';


  if (
    suspiciousName
  ) {

    suspicious = true;

    reason =
      'Suspicious filename';
  }


  if (
    metadata.width &&
    metadata.width > 5000
  ) {

    suspicious = true;

    reason =
      'Unusual image dimensions';
  }


  if (
    metadata.height &&
    metadata.height > 5000
  ) {

    suspicious = true;

    reason =
      'Unusual image dimensions';
  }


  return {
    suspicious,
    reason
  };
}


// =========================
// AUTH MIDDLEWARE
// =========================
const authenticate = (
  req: any,
  res: any,
  next: any
) => {

  const token =
    req.headers.authorization
      ?.split(' ')[1];


  if (!token) {

    return res
      .status(401)
      .json({

        error:
          'Unauthorized'
      });
  }


  try {

    req.user =
      jwt.verify(
        token,
        JWT_SECRET
      );

    next();

  } catch {

    return res
      .status(401)
      .json({

        error:
          'Invalid token'
      });
  }
};


// =========================
// SERVER
// =========================
async function startServer() {

  const app =
    express();

  app.use(
    express.json()
  );

  app.use(
    '/uploads',
    express.static(
      uploadsDir
    )
  );


  // =========================
  // REGISTER
  // =========================
  app.post(
    '/api/auth/register',

    async (
      req,
      res
    ) => {

      const {
        name,
        email,
        password
      } = req.body;


      const exists =
        db.users.find(
          u =>
            u.email ===
            email
        );


      if (exists) {

        return res
          .status(400)
          .json({

            error:
              'Email already exists'
          });
      }


      const hashedPassword =
        await bcrypt.hash(
          password,
          10
        );


      const newUser = {

        id:
          Date.now().toString(),

        name,

        email,

        password:
          hashedPassword,

        role:
          'citizen'
      };


      db.users.push(
        newUser
      );


      res.json({

        message:
          'Registration successful'
      });
    }
  );


  // =========================
  // LOGIN
  // =========================
  app.post(
    '/api/auth/login',

    async (
      req,
      res
    ) => {

      const {
        email,
        password
      } = req.body;


      const user =
        db.users.find(
          u =>
            u.email ===
            email
        );


      if (
        !user ||
        !(
          await bcrypt.compare(
            password,
            user.password
          )
        )
      ) {

        return res
          .status(401)
          .json({

            error:
              'Invalid credentials'
          });
      }


      const token =
        jwt.sign(

          {
            id: user.id,

            role:
              user.role,

            name:
              user.name,

            email:
              user.email
          },

          JWT_SECRET,

          {
            expiresIn:
              '1d'
          }
        );


      res.json({

        token,

        user: {

          id: user.id,

          name:
            user.name,

          email:
            user.email,

          role:
            user.role
        }
      });
    }
  );


  // =========================
  // PUBLIC COMPLAINTS
  // =========================
  app.get(
    '/api/public/complaints',

    (
      req,
      res
    ) => {

      const complaints =
        db.complaints.map(
          c => ({

            id: c.id,

            type:
              c.type,

            location:
              c.location,

            latitude:
              c.latitude,

            longitude:
              c.longitude,

            status:
              c.status,

            createdAt:
              c.createdAt
          })
        );


      res.json(
        complaints
      );
    }
  );


  // =========================
  // CREATE COMPLAINT
  // =========================
  app.post(
    '/api/complaints',

    authenticate,

    upload.single(
      'image'
    ),

    async (
      req: any,
      res
    ) => {

      try {

        const {
          type,
          description,
          location,
          latitude,
          longitude
        } = req.body;


        // AI IMAGE CHECK
        if (
          req.file
        ) {

          const result =
            await detectFakeAIImage(

              req.file.path,

              req.file
                .originalname
            );


          if (
            result.suspicious
          ) {

            fs.unlinkSync(
              req.file.path
            );

            return res
              .status(400)
              .json({

                error:
                  'AI-generated or suspicious image detected',

                reason:
                  result.reason
              });
          }
        }


        const complaint = {

          id:
            Date.now().toString(),

          userId:
            req.user.id,

          userName:
            req.user.name,

          userEmail:
            req.user.email,

          type,

          description,

          location,

          latitude:
            parseFloat(
              latitude
            ),

          longitude:
            parseFloat(
              longitude
            ),

          imagePath:
            req.file
              ? `/uploads/${req.file.filename}`
              : null,

          status:
            'Pending',

          createdAt:
            new Date().toISOString(),

          updates: [

            {
              status:
                'Pending',

              note:
                'Complaint submitted successfully',

              updatedAt:
                new Date().toISOString(),

              updatedBy:
                'System'
            }
          ]
        };


        db.complaints.push(
          complaint
        );


        res.json(
          complaint
        );

      } catch (
        err
      ) {

        console.error(
          err
        );

        res
          .status(500)
          .json({

            error:
              'Failed to create complaint'
          });
      }
    }
  );


  // =========================
  // USER COMPLAINTS
  // =========================
  app.get(
    '/api/complaints/me',

    authenticate,

    (
      req: any,
      res
    ) => {

      const complaints =
        db.complaints.filter(

          c =>
            c.userId ===
            req.user.id
        );


      res.json(
        complaints
      );
    }
  );


  // =========================
  // ADMIN COMPLAINTS
  // =========================
  app.get(
    '/api/admin/complaints',

    authenticate,

    (
      req: any,
      res
    ) => {

      if (
        req.user.role !==
        'admin'
      ) {

        return res
          .status(403)
          .json({

            error:
              'Forbidden'
          });
      }


      res.json(
        db.complaints
      );
    }
  );


  // =========================
  // ADMIN UPDATE STATUS
  // =========================
  app.patch(
    '/api/admin/complaints/:id',

    authenticate,

    (
      req: any,
      res
    ) => {

      if (
        req.user.role !==
        'admin'
      ) {

        return res
          .status(403)
          .json({

            error:
              'Forbidden'
          });
      }


      const {
        status,
        note
      } = req.body;


      const complaint =
        db.complaints.find(

          c =>
            c.id ===
            req.params.id
        );


      if (
        !complaint
      ) {

        return res
          .status(404)
          .json({

            error:
              'Complaint not found'
          });
      }


      complaint.status =
        status;


      complaint.updates.push({

        status,

        note,

        updatedAt:
          new Date().toISOString(),

        updatedBy:
          req.user.name
      });


      res.json(
        complaint
      );
    }
  );


  // =========================
  // ANALYTICS
  // =========================
  app.get(
    '/api/admin/analytics',

    authenticate,

    (
      req: any,
      res
    ) => {

      if (
        req.user.role !==
        'admin'
      ) {

        return res
          .status(403)
          .json({

            error:
              'Forbidden'
          });
      }


      const stats = {

        total:
          db.complaints.length,

        pending:
          db.complaints.filter(

            c =>
              c.status ===
              'Pending'
          ).length,

        inProgress:
          db.complaints.filter(

            c =>
              c.status ===
              'In Progress'
          ).length,

        resolved:
          db.complaints.filter(

            c =>
              c.status ===
              'Resolved'
          ).length,

        byType:
          db.complaints.reduce(

            (
              acc,
              curr
            ) => {

              acc[
                curr.type
              ] =
                (
                  acc[
                    curr.type
                  ] || 0
                ) + 1;

              return acc;

            },

            {} as any
          )
      };


      res.json(
        stats
      );
    }
  );


  // =========================
  // VITE
  // =========================
  if (
    process.env
      .NODE_ENV !==
    'production'
  ) {

    const vite =
      await createViteServer({

        server: {

          middlewareMode:
            true
        },

        appType:
          'spa'
      });


    app.use(
      vite.middlewares
    );

  } else {

    const distPath =
      path.join(
        __dirname,
        'dist'
      );

    app.use(
      express.static(
        distPath
      )
    );


    app.get(
      '*',

      (
        req,
        res
      ) => {

        res.sendFile(
          path.join(
            distPath,
            'index.html'
          )
        );
      }
    );
  }


  // =========================
  // START SERVER
  // =========================
  app.listen(
    PORT,
    '0.0.0.0',

    () => {

      console.log(
        `Server running on http://localhost:${PORT}`
      );
    }
  );
}


startServer();